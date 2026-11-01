param([Parameter(Mandatory = $true)][string]$CoveragePath)

$ErrorActionPreference = 'Stop'
$helper = Join-Path $PSScriptRoot 'stop-visual-process-tree.ps1'
$expectedCoverage = Join-Path (Split-Path $PSScriptRoot -Parent) 'coverage/governance/powershell.xml'
if ([IO.Path]::GetFullPath($CoveragePath) -ne [IO.Path]::GetFullPath($expectedCoverage)) {
    throw 'PowerShell coverage must use its owned governance report path.'
}

function New-MeasuredBreakpoints {
    param([string]$ScriptPath)

    $tokens = $null
    $parseErrors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $ScriptPath, [ref]$tokens, [ref]$parseErrors
    )
    if ($parseErrors.Count) { throw 'Coverage source must parse successfully.' }
    $lines = @($ast.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.CommandBaseAst] -or
        $node -is [System.Management.Automation.Language.AssignmentStatementAst] -or
        $node -is [System.Management.Automation.Language.ReturnStatementAst] -or
        $node -is [System.Management.Automation.Language.ThrowStatementAst] -or
        $node -is [System.Management.Automation.Language.ExitStatementAst] -or
        $node -is [System.Management.Automation.Language.BreakStatementAst] -or
        $node -is [System.Management.Automation.Language.ContinueStatementAst]
    }, $true) | ForEach-Object { $_.Extent.StartLineNumber } | Sort-Object -Unique)
    if (-not $lines.Count) { throw 'Coverage source must contain executable lines.' }
    $owned = [System.Collections.Generic.List[object]]::new()
    try {
        foreach ($line in $lines) {
            $owned.Add((Set-PSBreakpoint -Script $ScriptPath -Line $line -Action {}))
        }
        return $owned.ToArray()
    } catch {
        $owned | Remove-PSBreakpoint
        throw
    }
}

# A real unvisited branch must stay missed; the collector never infers hits from source.
[Console]::Error.WriteLine('Visual process fixture: measuring PowerShell execution.')
$probe = Join-Path ([IO.Path]::GetTempPath()) ('kernel-visual-coverage-' + [guid]::NewGuid().ToString('N') + '.ps1')
$probeBreakpoints = @()
try {
    $probeSource = @('param([bool]$TakeBranch)', '$value = 1', 'if ($TakeBranch) {', '    $value = 2', '}', 'return $value') -join [Environment]::NewLine
    [IO.File]::WriteAllText($probe, $probeSource)
    $probeBreakpoints = @(New-MeasuredBreakpoints $probe)
    $probeResult = & $probe $false
    $positive = @($probeBreakpoints | Where-Object { $_.Line -eq 2 })
    $negative = @($probeBreakpoints | Where-Object { $_.Line -eq 4 })
    if ($probeResult -ne 1 -or $positive.Count -ne 1 -or $positive[0].HitCount -le 0 -or
        $negative.Count -ne 1 -or $negative[0].HitCount -ne 0) {
        throw 'Native breakpoint coverage must distinguish executed and unvisited lines.'
    }
} finally {
    $probeBreakpoints | Remove-PSBreakpoint
    if ([IO.File]::Exists($probe)) { [IO.File]::Delete($probe) }
}

$breakpoints = @()
$nativeGuards = @()
try {
    $breakpoints = @(New-MeasuredBreakpoints $helper)
    $nativeGuards = @(Set-PSBreakpoint -Command Get-CimInstance, Get-Process -Action {
        [Console]::Error.WriteLine('Synthetic visual fixtures must never inspect native processes.')
        [Environment]::Exit(81)
    })
    $global:Requests = [System.Collections.Generic.List[int]]::new()
    $global:Killed = [System.Collections.Generic.List[int]]::new()
    $global:Disposed = [System.Collections.Generic.List[int]]::new()
    $global:Events = [System.Collections.Generic.List[string]]::new()
    $global:Waits = [System.Collections.Generic.List[int]]::new()
    $global:EnumerationOverride = $null
    $global:EnumerationFailure = $null
    $global:ProcessInfos = @(
        [pscustomobject]@{ProcessId=20; ParentProcessId=10; CreationDate=[datetime]'2026-10-31T00:02:00Z'},
        [pscustomobject]@{ProcessId=99; ParentProcessId=1; CreationDate=[datetime]'2026-10-31T00:04:00Z'},
        [pscustomobject]@{ProcessId=30; ParentProcessId=20; CreationDate=[datetime]'2026-10-31T00:03:00Z'},
        [pscustomobject]@{ProcessId=10; ParentProcessId=1; CreationDate=[datetime]'2026-10-31T00:01:00Z'},
        [pscustomobject]@{ProcessId=40; ParentProcessId=10; CreationDate=[datetime]'2026-10-30T00:01:00Z'}
    )
    $global:Missing = @()
    $global:Reused = @()
    $global:Denied = @()
    $global:WaitFailed = @()
    $global:DisposeFailed = @()
    function Read-SyntheticProcesses { param($ClassName, $Property, $ErrorAction)
        if ($args.Count) { throw 'Process enumeration received unexpected arguments.' }
        if ($ErrorAction -ne 'Stop') { throw 'Process enumeration must fail closed.' }
        if ($ClassName -ne 'Win32_Process') { throw 'Unexpected process class' }
        if (($Property -join ',') -ne 'ProcessId,ParentProcessId,CreationDate') { throw 'Unexpected process metadata' }
        $global:Requests.Add(0)
        if ($global:EnumerationFailure) { throw [System.InvalidOperationException]::new($global:EnumerationFailure) }
        if ($null -ne $global:EnumerationOverride) { return $global:EnumerationOverride }
        return $global:ProcessInfos
    }
    function Read-SyntheticProcess { param($Id, $ErrorAction)
        if ($ErrorAction -ne 'Stop') { throw 'Process lookup must fail closed.' }
        $global:Requests.Add([int]$Id)
        if ($global:Missing -contains $Id) { return $null }
        $info = $global:ProcessInfos | Where-Object { $_.ProcessId -eq $Id }
        if (-not $info) { throw 'Unowned PID lookup' }
        $start = $info.CreationDate
        if ($global:Reused -contains $Id) { $start = $start.AddSeconds(1) }
        $result = [pscustomobject]@{Id=[int]$Id; StartTime=$start}
        $result | Add-Member ScriptProperty SafeHandle { $global:Events.Add('pin:' + $this.Id); return 1 }
        $result | Add-Member ScriptMethod Kill {
            if ($global:Denied -contains $this.Id) { throw 'Synthetic AccessDenied' }
            $global:Events.Add('kill:' + $this.Id)
            $global:Killed.Add($this.Id)
        }
        $result | Add-Member ScriptMethod WaitForExit {
            if ($args.Count) { throw 'Process exit waits must not receive a timeout.' }
            $global:Events.Add('wait:' + $this.Id)
            $global:Waits.Add($this.Id)
            if ($global:WaitFailed -contains $this.Id) { throw "Synthetic exit wait failed for PID $($this.Id)" }
        }
        $result | Add-Member ScriptMethod Dispose {
            $global:Events.Add('dispose:' + $this.Id)
            $global:Disposed.Add($this.Id)
            if ($global:DisposeFailed -contains $this.Id) { throw "Synthetic disposal failed for PID $($this.Id)" }
        }
        return $result
    }
    $readProcesses = {
        param($ClassName, $Property, $ErrorAction)
        if ($args.Count) { throw 'Process enumeration received unexpected arguments.' }
        Read-SyntheticProcesses -ClassName $ClassName -Property $Property `
            -ErrorAction $ErrorAction
    }
    $readProcess = {
        param($Id, $ErrorAction)
        Read-SyntheticProcess -Id $Id -ErrorAction $ErrorAction
    }
    . $helper
    if ($global:Requests.Count) { throw 'Import must not inspect or terminate processes' }
    [Console]::Error.WriteLine('Visual process fixture: checking owned identities and actual exit waits.')
    $after = [datetimeoffset]'2026-10-31T00:00:59.999Z'
    $before = [datetimeoffset]'2026-10-31T00:01:00.001Z'
    $rejected = $false
    try { Get-VisualProcessTreeSnapshot 10 $after.AddMinutes(-2) $before.AddMinutes(-2) -ReadProcesses $readProcesses } catch {
        $rejected = $_.Exception.Message -match 'owned creation window'
    }
    if (-not $rejected -or $global:Killed.Count) { throw 'A reused root PID must not become owned ancestry' }
    $snapshot = Get-VisualProcessTreeSnapshot 10 $after $before -ReadProcesses $readProcesses
    if (($snapshot.processes.processId -join ',') -ne '30,20,10') { throw 'Wrong owned descendant order' }
    Stop-VisualProcessTreeSnapshot 10 $snapshot -ReadProcess $readProcess
    if (($global:Killed -join ',') -ne '30,20,10') { throw 'Children must stop before their owned root' }
    if (($global:Events -join ',') -ne 'pin:30,kill:30,pin:20,kill:20,pin:10,kill:10,wait:30,dispose:30,wait:20,dispose:20,wait:10,dispose:10') {
        throw 'Pinned identities must all receive termination before any actual exit wait and disposal.'
    }
    if (($global:Waits -join ',') -ne '30,20,10') { throw 'Successful cleanup must await every terminated process.' }
    if (($global:Disposed -join ',') -ne '30,20,10') { throw 'Process handles leaked' }
    $global:Killed.Clear(); $global:Disposed.Clear(); $global:Reused = @(20)
    $rejected = $false
    try { Stop-VisualProcessTreeSnapshot 10 $snapshot -ReadProcess $readProcess } catch { $rejected = $_.Exception.Message -match 'was reused' }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,10') { throw 'A reused PID must never be killed' }
    if (-not $global:Disposed.Contains(20)) { throw 'Rejected identity handle leaked' }
    $global:Killed.Clear(); $global:Reused = @(); $global:Missing = @(20)
    Stop-VisualProcessTreeSnapshot 10 $snapshot -ReadProcess $readProcess
    if (($global:Killed -join ',') -ne '30,10') { throw 'Missing processes must not hide remaining owned children' }
    $global:Killed.Clear(); $global:Missing = @(); $global:Denied = @(20)
    $rejected = $false
    try { Stop-VisualProcessTreeSnapshot 10 $snapshot -ReadProcess $readProcess } catch { $rejected = $_.Exception.Message -match 'AccessDenied' }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,10') { throw 'Cleanup failures must remain visible while remaining owned cleanup runs' }
    $global:Denied = @(); $global:WaitFailed = @(20); $rejected = $false
    $global:Killed.Clear(); $global:Waits.Clear(); $global:Disposed.Clear()
    try { Stop-VisualProcessTreeSnapshot 10 $snapshot -ReadProcess $readProcess } catch { $rejected = $_.Exception.Message -match 'Synthetic exit wait failed for PID 20' }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,20,10' -or
        ($global:Waits -join ',') -ne '30,20,10' -or ($global:Disposed -join ',') -ne '30,20,10') {
        throw 'A failed exit wait must remain visible without skipping remaining waits or leaking pinned handles.'
    }
    $global:WaitFailed = @(); $global:Requests.Clear()
    $invalid = $snapshot | ConvertTo-Json -Depth 5 | ConvertFrom-Json
    $invalid.processes[0].parentProcessId = 99
    $rejected = $false
    try { Stop-VisualProcessTreeSnapshot 10 $invalid -ReadProcess $readProcess } catch { $rejected = $_.Exception.Message -match 'unowned process' }
    if (-not $rejected -or $global:Requests.Count) { throw 'Malformed ownership must fail before any process access' }


    # Exercise actual CLI dispatch under the same synthetic process mocks and collector.
    $global:WaitFailed = @(); $global:Denied = @(); $global:Missing = @(); $global:Reused = @()
    $global:Killed.Clear(); $global:Disposed.Clear()
    $cliSnapshot = Invoke-VisualProcessTreeCommand -Mode Snapshot -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadProcesses $readProcesses -ReadProcess $readProcess |
        ConvertFrom-Json
    if (($cliSnapshot.processes.processId -join ',') -ne '30,20,10') {
        throw 'CLI snapshot must preserve verified children-first ownership.'
    }
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(
        ($cliSnapshot | ConvertTo-Json -Depth 5 -Compress)
    ))
    Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    if (($global:Killed -join ',') -ne '30,20,10') {
        throw 'CLI cleanup must terminate only the captured synthetic tree.'
    }

    # A refreshed tree adds new descendants without dropping the original captured orphans.
    [Console]::Error.WriteLine('Visual process fixture: checking refreshed ancestry and safe branches.')
    $baselineInfos = $global:ProcessInfos
    $global:ProcessInfos = @(
        [pscustomobject]@{ProcessId=10; ParentProcessId=20; CreationDate=[datetime]'2026-10-31T00:01:00Z'},
        [pscustomobject]@{ProcessId=20; ParentProcessId=10; CreationDate=[datetime]'2026-10-31T00:02:00Z'},
        [pscustomobject]@{ProcessId=30; ParentProcessId=20; CreationDate=[datetime]'2026-10-31T00:03:00Z'}
    )
    $externalParent = [pscustomobject]@{
        schemaVersion=1; rootProcessId=10; processes=@(
            [pscustomobject]@{processId=20; parentProcessId=10; createdAt=([datetime]'2026-10-31T00:02:00Z').ToUniversalTime().Ticks.ToString()},
            [pscustomobject]@{processId=10; parentProcessId=20; createdAt=([datetime]'2026-10-31T00:01:00Z').ToUniversalTime().Ticks.ToString()}
        )
    }
    $freshWithExternalParent = Get-VisualProcessTreeSnapshot 10 $after $before -ReadProcesses $readProcesses
    $mergedWithExternalParent = Merge-VisualProcessTreeSnapshots 10 $externalParent $freshWithExternalParent
    if (($mergedWithExternalParent.snapshot.processes.processId -join ',') -ne '30,20,10' -or
        $mergedWithExternalParent.snapshot.processes[-1].parentProcessId -ne 20 -or
        $mergedWithExternalParent.conflicts.Count) {
        throw 'A reused external parent PID must not become an owned root backedge.'
    }
    $externalParentEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(
        ($externalParent | ConvertTo-Json -Depth 5 -Compress)
    ))
    $global:Killed.Clear()
    Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before `
        -ReadInput { $externalParentEncoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    if (($global:Killed -join ',') -ne '30,20,10') {
        throw 'External root parent metadata must preserve finite children-first cleanup.'
    }
    $global:ProcessInfos = $baselineInfos

    $newChildren = @(
        [pscustomobject]@{ProcessId=50; ParentProcessId=10; CreationDate=[datetime]'2026-10-31T00:04:00Z'},
        [pscustomobject]@{ProcessId=60; ParentProcessId=50; CreationDate=[datetime]'2026-10-31T00:05:00Z'}
    )
    $global:ProcessInfos = @($baselineInfos) + @($newChildren)
    $global:EnumerationOverride = @($baselineInfos | Where-Object { $_.ProcessId -eq 10 }) + @($newChildren)
    $global:Killed.Clear(); $global:Disposed.Clear()
    Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    if (($global:Killed -join ',') -ne '30,20,60,50,10') {
        throw 'Refresh must retain captured orphans and add new descendants in children-first order.'
    }

    $global:ProcessInfos = $baselineInfos
    $global:EnumerationOverride = @($baselineInfos | Where-Object { $_.ProcessId -ne 10 })
    $global:Missing = @(10); $global:Killed.Clear()
    Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    if (($global:Killed -join ',') -ne '30,20') {
        throw 'A root that exited during taskkill must not strand its captured orphans.'
    }

    # Reused identities cannot replace captured ancestry or make new children owned.
    $global:Missing = @(); $global:EnumerationOverride = $null
    $global:ProcessInfos = @($baselineInfos | ForEach-Object {
        if ($_.ProcessId -eq 20) {
            [pscustomobject]@{ProcessId=20; ParentProcessId=10; CreationDate=$_.CreationDate.AddMinutes(10)}
        } else { $_ }
    }) + @([pscustomobject]@{ProcessId=70; ParentProcessId=20; CreationDate=[datetime]'2026-10-31T00:13:00Z'}) + @($newChildren)
    $global:Killed.Clear(); $global:Requests.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    } catch {
        $rejected = $_.Exception.Message -match 'conflicts with its captured identity' -and
            $_.Exception.Message -match 'was reused'
    }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,60,50,10' -or $global:Requests.Contains(70) -or
        -not $global:Requests.Contains(20)) {
        throw 'A reused descendant must reject its new subtree while safe refreshed branches and captured orphans are attempted.'
    }

    # A matching captured descendant cannot restore trust below conflicting fresh parentage.
    $global:ProcessInfos = @($baselineInfos | ForEach-Object {
        if ($_.ProcessId -eq 20) {
            [pscustomobject]@{ProcessId=20; ParentProcessId=50; CreationDate=$_.CreationDate}
        } else { $_ }
    }) + @(
        [pscustomobject]@{ProcessId=50; ParentProcessId=10; CreationDate=[datetime]'2026-10-31T00:01:30Z'},
        [pscustomobject]@{ProcessId=60; ParentProcessId=50; CreationDate=[datetime]'2026-10-31T00:05:00Z'},
        [pscustomobject]@{ProcessId=70; ParentProcessId=20; CreationDate=[datetime]'2026-10-31T00:06:00Z'},
        [pscustomobject]@{ProcessId=80; ParentProcessId=30; CreationDate=[datetime]'2026-10-31T00:06:00Z'},
        [pscustomobject]@{ProcessId=90; ParentProcessId=10; CreationDate=[datetime]'2026-10-31T00:07:00Z'}
    )
    $global:Killed.Clear(); $global:Requests.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    } catch { $rejected = $_.Exception.Message -match 'conflicts with its captured identity' }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,20,60,50,90,10' -or
        $global:Requests.Contains(70) -or $global:Requests.Contains(80)) {
        throw 'Conflicting fresh ancestry must never borrow captured ownership, discard safe siblings, or change captured parentage.'
    }

    $global:ProcessInfos = @($baselineInfos | ForEach-Object {
        if ($_.ProcessId -eq 10) {
            [pscustomobject]@{ProcessId=10; ParentProcessId=1; CreationDate=$_.CreationDate.AddTicks(10)}
        } else { $_ }
    }) + @($newChildren)
    $global:Killed.Clear(); $global:Requests.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    } catch {
        $rejected = $_.Exception.Message -match 'refreshed visual root identity changed' -and
            $_.Exception.Message -match 'was reused'
    }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,20' -or
        $global:Requests.Contains(50) -or $global:Requests.Contains(60)) {
        throw 'A different root identity within the spawn window must discard every fresh addition.'
    }

    $global:ProcessInfos = @($baselineInfos | ForEach-Object {
        if ($_.ProcessId -eq 10) {
            [pscustomobject]@{ProcessId=10; ParentProcessId=9; CreationDate=$_.CreationDate}
        } else { $_ }
    }) + @($newChildren)
    $global:Killed.Clear(); $global:Requests.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    } catch { $rejected = $_.Exception.Message -match 'refreshed visual root identity changed' }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,20,10' -or
        $global:Requests.Contains(50) -or $global:Requests.Contains(60)) {
        throw 'Changed root parent metadata must discard every fresh addition and preserve captured cleanup.'
    }

    $global:ProcessInfos = $baselineInfos
    $global:Killed.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } `
            -ReadProcesses { throw 'Synthetic refresh unavailable' } -ReadProcess $readProcess
    } catch { $rejected = $_.Exception.Message -match 'Synthetic refresh unavailable' }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,20,10') {
        throw 'Refresh failures must retain captured cleanup and remain visible.'
    }
    $global:EnumerationFailure = 'Synthetic process enumeration unavailable.'
    $global:Killed.Clear(); $global:Requests.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } `
            -ReadProcesses $readProcesses -ReadProcess $readProcess
    } catch {
        $rejected = $_.Exception.Message -match 'Synthetic process enumeration unavailable' -and
            ($global:Killed -join ',') -eq '30,20,10'
    }
    if (-not $rejected -or ($global:Requests -join ',') -ne '0,30,20,10') {
        throw 'An unavailable refresh must attempt captured cleanup before reporting its failure.'
    }
    $global:EnumerationFailure = $null
    $global:Denied = @(20); $global:Killed.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before -ReadInput { $encoded } `
            -ReadProcesses $readProcesses -ReadProcess $readProcess
    } catch { $rejected = $_.Exception.Message -match 'AccessDenied' }
    if (-not $rejected -or ($global:Killed -join ',') -ne '30,10') {
        throw 'A successful refresh cannot hide a native cleanup failure.'
    }
    $global:Denied = @()

    # Indexed traversal stays linear; all verified stops precede every actual exit wait.
    [Console]::Error.WriteLine('Visual process fixture: checking complete stop, wait and disposal order.')
    $global:ParentReads = 0
    $many = @()
    foreach ($number in @(10) + @(100..111)) {
        $parentId = if ($number -eq 10) { 1 } else { 10 }
        $created = if ($number -eq 10) { [datetime]'2026-10-31T00:01:00Z' } else { [datetime]'2026-10-31T00:02:00Z' }
        $info = [pscustomobject]@{ProcessId=$number; ParentValue=$parentId; CreationDate=$created}
        $info | Add-Member ScriptProperty ParentProcessId { $global:ParentReads++; return $this.ParentValue }
        $many += $info
    }
    $global:ProcessInfos = $many
    $manySnapshot = Get-VisualProcessTreeSnapshot 10 $after $before -ReadProcesses $readProcesses
    if ($global:ParentReads -gt (3 * $many.Count) -or
        ($manySnapshot.processes.processId -join ',') -ne ((@(100..111) + @(10)) -join ',')) {
        throw 'Snapshot traversal must index parents once and retain numeric sibling order.'
    }
    $global:Killed.Clear(); $global:Disposed.Clear(); $global:Requests.Clear(); $global:Waits.Clear(); $global:Events.Clear()
    $global:WaitFailed = @(100,110); $global:Reused = @(105); $global:DisposeFailed = @(100,105); $rejected = $false
    try {
        Stop-VisualProcessTreeSnapshot 10 $manySnapshot -ReadProcess $readProcess
    } catch {
        $rejected = $_.Exception.Message -match 'was reused' -and
            $_.Exception.Message -match 'Synthetic exit wait failed for PID 100' -and
            $_.Exception.Message -match 'Synthetic exit wait failed for PID 110' -and
            $_.Exception.Message -match 'Synthetic disposal failed for PID 100' -and
            $_.Exception.Message -match 'Synthetic disposal failed for PID 105'
    }
    $expectedStopped = @(100..111 | Where-Object { $_ -ne 105 }) + @(10)
    if (-not $rejected -or ($global:Killed -join ',') -ne ($expectedStopped -join ',') -or
        ($global:Waits -join ',') -ne ($expectedStopped -join ',') -or
        $global:Events.IndexOf('wait:100') -le $global:Events.IndexOf('kill:10') -or
        $global:Requests.Count -ne $many.Count -or $global:Disposed.Count -ne $many.Count -or
        (@($global:Disposed | Sort-Object) -join ',') -ne (@($many.ProcessId | Sort-Object) -join ',')) {
        throw 'Identity, wait and disposal failures must stay visible while every safe stop, exit wait and handle disposal is attempted.'
    }

    $global:WaitFailed = @(); $global:Reused = @(); $global:DisposeFailed = @(100)
    $global:Killed.Clear(); $global:Waits.Clear(); $global:Disposed.Clear(); $global:Events.Clear(); $rejected = $false
    try {
        Stop-VisualProcessTreeSnapshot 10 $manySnapshot -ReadProcess $readProcess
    } catch { $rejected = $_.Exception.Message -match 'Synthetic disposal failed for PID 100' }
    $expectedStopped = @(100..111) + @(10)
    if (-not $rejected -or ($global:Killed -join ',') -ne ($expectedStopped -join ',') -or
        ($global:Waits -join ',') -ne ($expectedStopped -join ',') -or
        ($global:Disposed -join ',') -ne ($expectedStopped -join ',') -or
        $global:Events.IndexOf('wait:100') -le $global:Events.IndexOf('kill:10')) {
        throw 'A disposal failure after successful process exit must not skip later exits or handle disposal.'
    }
    $global:ProcessInfos = $baselineInfos
    $global:EnumerationOverride = $null
    $global:WaitFailed = @(); $global:Reused = @(); $global:DisposeFailed = @()

    # Missing roots fail before an ownership snapshot is created.
    $originalInfos = $global:ProcessInfos
    $global:ProcessInfos = @($originalInfos | Where-Object { $_.ProcessId -ne 10 })
    $rejected = $false
    try { Get-VisualProcessTreeSnapshot 10 $after $before -ReadProcesses $readProcesses } catch {
        $rejected = $_.Exception.Message -match 'owned visual process no longer exists'
    }
    if (-not $rejected) { throw 'Missing root identity must remain a snapshot failure.' }
    $global:ProcessInfos = $originalInfos

    $global:Requests.Clear()
    $invalid = $snapshot | ConvertTo-Json -Depth 5 | ConvertFrom-Json
    $invalid.schemaVersion = 2
    $rejected = $false
    try { Stop-VisualProcessTreeSnapshot 10 $invalid -ReadProcess $readProcess } catch {
        $rejected = $_.Exception.Message -match 'does not identify its owned root'
    }
    if (-not $rejected -or $global:Requests.Count) {
        throw 'Invalid snapshot schema must fail before any process access.'
    }

    # Snapshot transport must not inherit Windows command-line size limits.
    $global:ProcessInfos = $baselineInfos
    $global:Missing = @(); $global:Reused = @(); $global:Denied = @()
    $global:WaitFailed = @(); $global:DisposeFailed = @(); $global:EnumerationOverride = $null
    $largeSnapshot = $cliSnapshot | ConvertTo-Json -Depth 5 | ConvertFrom-Json
    $largeSnapshot | Add-Member -NotePropertyName padding -NotePropertyValue ('x' * 50000)
    $largeEncoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(
        ($largeSnapshot | ConvertTo-Json -Depth 5 -Compress)
    ))
    if ($largeEncoded.Length -le 32767) { throw 'The transport fixture must exceed the Windows command-line limit.' }
    $global:Killed.Clear(); $global:Requests.Clear(); $global:Disposed.Clear()
    Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before `
        -ReadInput { $largeEncoded } -ReadProcesses $readProcesses -ReadProcess $readProcess
    if (($global:Killed -join ',') -ne '30,20,10') {
        throw 'A large streamed snapshot must preserve verified children-first cleanup.'
    }

    foreach ($invalidInput in @('', 'not-base64!', 'bm90LWpzb24=')) {
        $global:Killed.Clear(); $global:Requests.Clear(); $rejected = $false
        try {
            Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before `
                -ReadInput { $invalidInput } -ReadProcesses $readProcesses -ReadProcess $readProcess
        } catch { $rejected = $true }
        if (-not $rejected -or $global:Killed.Count -or $global:Requests.Count) {
            throw 'Invalid streamed ownership input must fail before any process enumeration or termination.'
        }
    }
    $global:Killed.Clear(); $global:Requests.Clear(); $rejected = $false
    try {
        Invoke-VisualProcessTreeCommand -Mode Stop -RootProcessId 10 -StartedAfter $after -StartedBefore $before `
            -ReadInput { throw 'Synthetic snapshot input unavailable' } -ReadProcesses $readProcesses -ReadProcess $readProcess
    } catch { $rejected = $_.Exception.Message -match 'Synthetic snapshot input unavailable' }
    if (-not $rejected -or $global:Killed.Count -or $global:Requests.Count) {
        throw 'Snapshot input failures must remain visible without accessing any process.'
    }

    if (-not @($breakpoints | Where-Object { $_.HitCount -gt 0 }).Count) {
        throw 'PowerShell helper execution must produce measured breakpoint hits.'
    }
    [Console]::Error.WriteLine('Visual process fixture: exporting measured coverage.')
    $settings = [System.Xml.XmlWriterSettings]::new()
    $settings.Encoding = [System.Text.UTF8Encoding]::new($false)
    $settings.Indent = $true
    $writer = [System.Xml.XmlWriter]::Create($CoveragePath, $settings)
    try {
        $writer.WriteStartDocument()
        $writer.WriteStartElement('coverage')
        $writer.WriteAttributeString('version', '1')
        $writer.WriteStartElement('file')
        $writer.WriteAttributeString('path', 'scripts/stop-visual-process-tree.ps1')
        foreach ($breakpoint in $breakpoints | Sort-Object Line) {
            $writer.WriteStartElement('lineToCover')
            $writer.WriteAttributeString('lineNumber', $breakpoint.Line.ToString())
            $writer.WriteAttributeString('covered', ($breakpoint.HitCount -gt 0).ToString().ToLowerInvariant())
            $writer.WriteEndElement()
        }
        $writer.WriteEndElement()
        $writer.WriteEndElement()
        $writer.WriteEndDocument()
    } finally {
        $writer.Dispose()
    }
} finally {
    @($breakpoints) + @($nativeGuards) | Remove-PSBreakpoint
}
Write-Output 'synthetic-owned-tree-fallback-passed'
