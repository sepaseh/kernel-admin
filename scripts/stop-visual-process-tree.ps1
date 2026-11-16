param(
    [ValidateSet('Snapshot', 'Stop')][string]$Mode = 'Snapshot',
    [int]$RootProcessId,
    [datetimeoffset]$StartedAfter,
    [datetimeoffset]$StartedBefore
)

function Get-VisualProcessChildrenIndex {
    param($Processes)

    $children = @{}
    foreach ($processInfo in $Processes) {
        $parentId = [int]$processInfo.ParentProcessId
        if (-not $children.ContainsKey($parentId)) {
            $children[$parentId] = [System.Collections.Generic.List[object]]::new()
        }
        $children[$parentId].Add($processInfo)
    }
    return $children
}

function Get-VisualProcessTreeSnapshot {
    param(
        [ValidateRange(1, [int]::MaxValue)][int]$RootProcessId,
        [datetimeoffset]$StartedAfter,
        [datetimeoffset]$StartedBefore,
        [scriptblock]$ReadProcesses
    )

    $processes = if ($ReadProcesses) {
        @(& $ReadProcesses -ClassName Win32_Process `
            -Property ProcessId, ParentProcessId, CreationDate -ErrorAction Stop)
    } else {
        @(Get-CimInstance -ClassName Win32_Process `
            -Property ProcessId, ParentProcessId, CreationDate -ErrorAction Stop)
    }
    $root = $processes | Where-Object { $_.ProcessId -eq $RootProcessId }
    if (-not $root) { throw 'The owned visual process no longer exists.' }
    $created = $root.CreationDate.ToUniversalTime()
    if ($StartedBefore -le $StartedAfter -or
        $created -lt $StartedAfter.UtcDateTime -or
        $created -ge $StartedBefore.UtcDateTime) {
        throw 'The visual root identity does not match its owned creation window.'
    }
    $children = Get-VisualProcessChildrenIndex $processes
    $ordered = [System.Collections.Generic.List[object]]::new()
    $visited = [System.Collections.Generic.HashSet[int]]::new()
    $visit = {
        param($processInfo)
        if (-not $visited.Add([int]$processInfo.ProcessId)) {
            throw 'The visual process ancestry contains a cycle.'
        }
        foreach ($child in @($children[[int]$processInfo.ProcessId] | Sort-Object ProcessId)) {
            if ($child.CreationDate -ge $processInfo.CreationDate) { & $visit $child }
        }
        $ordered.Add([pscustomobject]@{
            processId = [int]$processInfo.ProcessId
            parentProcessId = [int]$processInfo.ParentProcessId
            createdAt = $processInfo.CreationDate.ToUniversalTime().Ticks.ToString()
        })
    }
    & $visit $root
    return [pscustomobject]@{
        schemaVersion = 1
        rootProcessId = $RootProcessId
        processes = @($ordered.ToArray())
    }
}

function Get-ValidatedVisualProcessEntries {
    param(
        [ValidateRange(1, [int]::MaxValue)][int]$RootProcessId,
        $Snapshot
    )

    $entries = @($Snapshot.processes)
    if ($Snapshot.schemaVersion -ne 1 -or
        $Snapshot.rootProcessId -ne $RootProcessId -or
        $entries.Count -eq 0 -or
        $entries[-1].processId -ne $RootProcessId) {
        throw 'The visual process snapshot does not identify its owned root.'
    }
    $ancestry = @{}
    for ($index = $entries.Count - 1; $index -ge 0; $index--) {
        $entry = $entries[$index]
        if ($entry.processId -le 0 -or
            $ancestry.ContainsKey([int]$entry.processId) -or
            $entry.createdAt -notmatch '^\d+$' -or
            ($index -ne $entries.Count - 1 -and
             (-not $ancestry.ContainsKey([int]$entry.parentProcessId) -or
              [long]$entry.createdAt -lt $ancestry[[int]$entry.parentProcessId]))) {
            throw 'The visual process snapshot contains an unowned process.'
        }
        $ancestry[[int]$entry.processId] = [long]$entry.createdAt
    }
    return ,$entries
}

function Stop-VerifiedVisualProcess {
    param(
        $Entry,
        [scriptblock]$ReadProcess
    )

    try {
        $current = if ($ReadProcess) {
            & $ReadProcess -Id $Entry.processId -ErrorAction Stop
        } else {
            Get-Process -Id $Entry.processId -ErrorAction Stop
        }
    } catch {
        if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') { return }
        throw
    }
    if (-not $current) { return }
    try {
        # Keep a stable process handle from identity verification through termination.
        $null = $current.SafeHandle
        $createdAt = $current.StartTime.ToUniversalTime().Ticks
        $microseconds = ($createdAt - ($createdAt % 10)).ToString()
        if ($microseconds -ne $Entry.createdAt) {
            throw "The captured visual PID $($Entry.processId) was reused."
        }
        $current.Kill()
        return $current
    } catch {
        $failure = $_
        try {
            $current.Dispose()
        } catch {
            throw "$($failure.Exception.Message); process handle disposal failed: $($_.Exception.Message)"
        }
        throw $failure
    }
}

function Stop-VisualProcessTreeSnapshot {
    param(
        [ValidateRange(1, [int]::MaxValue)][int]$RootProcessId,
        $Snapshot,
        [scriptblock]$ReadProcess
    )

    $entries = Get-ValidatedVisualProcessEntries $RootProcessId $Snapshot
    $failures = [System.Collections.Generic.List[string]]::new()
    $pending = [System.Collections.Generic.List[object]]::new()
    foreach ($entry in $entries) {
        try {
            $current = Stop-VerifiedVisualProcess $entry -ReadProcess $ReadProcess
            if ($current) { $pending.Add($current) }
        } catch {
            $failures.Add($_.Exception.Message)
        }
    }

    # Issue every verified stop before an exit wait can block the remaining tree.
    foreach ($current in $pending) {
        try {
            $current.WaitForExit()
        } catch {
            $failures.Add($_.Exception.Message)
        } finally {
            try {
                $current.Dispose()
            } catch {
                $failures.Add($_.Exception.Message)
            }
        }
    }
    if ($failures.Count) {
        throw "Verified visual process cleanup failed: $($failures -join '; ')"
    }
}

function Add-RefreshedVisualProcessEntries {
    param($Identities, $FreshEntries, [int]$RootProcessId)

    $rejected = [System.Collections.Generic.HashSet[int]]::new()
    $conflicts = [System.Collections.Generic.List[string]]::new()
    for ($index = $FreshEntries.Count - 1; $index -ge 0; $index--) {
        $entry = $FreshEntries[$index]
        $processId = [int]$entry.processId
        if ($processId -ne $RootProcessId -and $rejected.Contains([int]$entry.parentProcessId)) {
            $null = $rejected.Add($processId)
            continue
        }

        if ($Identities.ContainsKey($processId)) {
            $known = $Identities[$processId]
            if ($known.createdAt -ne $entry.createdAt -or
                $known.parentProcessId -ne $entry.parentProcessId) {
                $null = $rejected.Add($processId)
                $conflicts.Add("The refreshed visual PID $processId conflicts with its captured identity.")
            }
        } else {
            $Identities[$processId] = $entry
        }
    }
    return $conflicts.ToArray()
}

function Merge-VisualProcessTreeSnapshots {
    param([int]$RootProcessId, $Original, $Fresh)

    $originalEntries = Get-ValidatedVisualProcessEntries $RootProcessId $Original
    $freshEntries = Get-ValidatedVisualProcessEntries $RootProcessId $Fresh
    if ($originalEntries[-1].createdAt -ne $freshEntries[-1].createdAt -or
        $originalEntries[-1].parentProcessId -ne $freshEntries[-1].parentProcessId) {
        throw 'The refreshed visual root identity changed.'
    }
    $identities = @{}
    foreach ($entry in $originalEntries) {
        $identities[[int]$entry.processId] = $entry
    }
    $conflicts = @(Add-RefreshedVisualProcessEntries $identities $freshEntries $RootProcessId)
    $children = Get-VisualProcessChildrenIndex @(
        $identities.Values | Where-Object { $_.processId -ne $RootProcessId }
    )
    $ordered = [System.Collections.Generic.List[object]]::new()
    $visit = {
        param($entry)
        foreach ($child in @($children[[int]$entry.processId] | Sort-Object ProcessId)) {
            & $visit $child
        }
        $ordered.Add($entry)
    }
    & $visit $identities[$RootProcessId]
    $snapshot = [pscustomobject]@{
        schemaVersion = 1
        rootProcessId = $RootProcessId
        processes = @($ordered.ToArray())
    }
    return [pscustomobject]@{ snapshot = $snapshot; conflicts = $conflicts }
}

function Stop-CapturedVisualProcessTree {
    param(
        [int]$RootProcessId,
        $Snapshot,
        [datetimeoffset]$StartedAfter,
        [datetimeoffset]$StartedBefore,
        [scriptblock]$ReadProcesses,
        [scriptblock]$ReadProcess
    )

    $null = Get-ValidatedVisualProcessEntries $RootProcessId $Snapshot
    $refreshFailure = $null
    try {
        $fresh = Get-VisualProcessTreeSnapshot $RootProcessId $StartedAfter $StartedBefore `
            -ReadProcesses $ReadProcesses
        $merged = Merge-VisualProcessTreeSnapshots $RootProcessId $Snapshot $fresh
        $Snapshot = $merged.snapshot
        if ($merged.conflicts.Count) {
            $refreshFailure = [System.InvalidOperationException]::new($merged.conflicts -join '; ')
        }
    } catch {
        if ($_.Exception.Message -notmatch 'owned visual process no longer exists') {
            $refreshFailure = $_.Exception
        }
    }
    try {
        Stop-VisualProcessTreeSnapshot $RootProcessId $Snapshot -ReadProcess $ReadProcess
    } catch {
        if ($refreshFailure) {
            throw "Visual snapshot refresh and cleanup failed: $($refreshFailure.Message); $($_.Exception.Message)"
        }
        throw
    }
    if ($refreshFailure) { throw $refreshFailure }
}

function Invoke-VisualProcessTreeCommand {
    param(
        [ValidateSet('Snapshot', 'Stop')][string]$Mode,
        [ValidateRange(1, [int]::MaxValue)][int]$RootProcessId,
        [datetimeoffset]$StartedAfter,
        [datetimeoffset]$StartedBefore,
        [scriptblock]$ReadInput,
        [scriptblock]$ReadProcesses,
        [scriptblock]$ReadProcess
    )

    if ($Mode -eq 'Snapshot') {
        Get-VisualProcessTreeSnapshot $RootProcessId $StartedAfter $StartedBefore `
            -ReadProcesses $ReadProcesses | ConvertTo-Json -Depth 5 -Compress
    } else {
        $snapshotBase64 = if ($ReadInput) { & $ReadInput } else { [Console]::In.ReadToEnd() }
        if ([string]::IsNullOrWhiteSpace($snapshotBase64)) {
            throw 'The owned visual process snapshot input is missing.'
        }
        $snapshot = [System.Text.Encoding]::UTF8.GetString(
            [Convert]::FromBase64String($snapshotBase64)
        ) | ConvertFrom-Json
        Stop-CapturedVisualProcessTree $RootProcessId $snapshot $StartedAfter $StartedBefore `
            -ReadProcesses $ReadProcesses -ReadProcess $ReadProcess
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        Invoke-VisualProcessTreeCommand -Mode $Mode -RootProcessId $RootProcessId `
            -StartedAfter $StartedAfter -StartedBefore $StartedBefore
    } catch {
        [Console]::Error.WriteLine($_.Exception.Message)
        exit 1
    }
}
