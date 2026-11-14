import { isCancel } from "axios";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  cloneElement,
  type PropsWithChildren,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import type { DefaultLayoutContext } from "@/layouts/default";
import { useAbortController, useLock } from "@/shared/hooks";
import "@/shared/i18n";
import { ErrorFallback } from "@/shared/ui/error-boundary";

import {
  Button,
  Calendar,
  type CalendarProps,
  Card,
  Col,
  Flex,
  Row,
  Select,
  Spin,
} from "antd";

import {
  createCalendarDate,
  deleteCalendarDate,
  fetchCalendarDates,
} from "./api";
import { useCalendarStyles } from "./styles";

type Cell = ReactElement<PropsWithChildren<{ className?: string }>>;
type SelectInfo = Parameters<NonNullable<CalendarProps<Dayjs>["onSelect"]>>[1];

const formatDate = (date: Dayjs) =>
  (date.calendar("gregory") as unknown as Dayjs).format("YYYY-MM-DD");

export const CalendarPage = () => {
  const { t } = useTranslation();
  const [dates, setDates] = useState<string[]>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingDate, setSubmittingDate] = useState<string>();
  const { cancel: cancelDates, start: startDates } = useAbortController();
  const { messageAPI, token } = useAntd();
  const { styles } = useCalendarStyles();
  const { settings } = useCore();
  const { lock, unlock } = useLock();
  const { currentUser } = useOutletContext<DefaultLayoutContext>();
  const { canUpdate } = getRoutePermissions("calendar", currentUser);
  const { language } = settings;
  const rtl = language.direction === "rtl";

  const { months, years } = useMemo(() => {
    const currentYear = (
      dayjs().calendar(language.calendar) as unknown as Dayjs
    ).year();

    return {
      months: Array.from({ length: 12 }, (_, index) => ({
        label: (dayjs().calendar(language.calendar) as unknown as Dayjs)
          .locale(language.code)
          .month(index)
          .format("MMMM"),
        value: index,
      })),
      years: Array.from({ length: 12 }, (_, index) => ({
        label: currentYear + index,
        value: currentYear + index,
      })),
    };
  }, [language.calendar, language.code]);

  const fetchData = useCallback(async () => {
    const signal = startDates();
    setLoading(true);

    try {
      const data = await fetchCalendarDates(signal);
      if (signal.aborted) return;

      setDates(data);
    } catch (error) {
      if (signal.aborted || isCancel(error)) return;

      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [messageAPI, startDates]);

  const handleSelect = async (
    date: Dayjs,
    selectInfo: SelectInfo,
  ): Promise<void> => {
    if (
      !canUpdate ||
      !dates ||
      loading ||
      selectInfo.source !== "date" ||
      submitting ||
      !lock()
    )
      return;

    const formattedDate = formatDate(date);
    const remove = dates.includes(formattedDate);
    setSubmittingDate(formattedDate);
    setSubmitting(true);

    try {
      cancelDates();

      if (remove) await deleteCalendarDate(formattedDate);
      else await createCalendarDate(formattedDate);

      setDates((current) => {
        if (!current) return current;

        return remove
          ? current.filter((value) => value !== formattedDate)
          : [...current, formattedDate];
      });
      void messageAPI.success(t("calendarUpdated"));
      await fetchData();
    } catch (error) {
      if (error instanceof Error) void messageAPI.error(error.message);
    } finally {
      unlock();
      setSubmitting(false);
    }
  };

  const fullCellRender: CalendarProps<Dayjs>["fullCellRender"] = (
    date,
    info,
  ) => {
    if (info.type !== "date") return info.originNode;

    const formattedDate = formatDate(date);
    const originNode = info.originNode as Cell;

    return cloneElement(originNode, {
      children:
        submitting && submittingDate === formattedDate ? (
          <Spin size="small" />
        ) : (
          date.date()
        ),
      className: [
        styles.cell,
        dates?.includes(formattedDate) ? styles.holiday : undefined,
      ]
        .filter(Boolean)
        .join(" "),
    });
  };

  const renderHeader: CalendarProps<Dayjs>["headerRender"] = ({
    onChange,
    value,
  }) => {
    const hasPreviousMonth = value.isAfter(
      (dayjs().calendar(language.calendar) as unknown as Dayjs).startOf("year"),
      "month",
    );

    return (
      <Flex
        align="center"
        justify="space-between"
        style={{ paddingBlockEnd: token.paddingSM }}
      >
        <Flex gap={8}>
          <Select
            aria-label={t("calendarYear")}
            onChange={(year) => onChange(value.clone().year(year))}
            options={years}
            style={{ width: 120 }}
            value={value.year()}
          />
          <Select
            aria-label={t("calendarMonth")}
            onChange={(month) => onChange(value.clone().month(month))}
            options={months}
            style={{ width: 120 }}
            value={value.month()}
          />
        </Flex>
        <Flex gap={8}>
          <Button
            aria-label={t("previousMonth")}
            disabled={!hasPreviousMonth}
            icon={
              rtl ? (
                <ChevronRight aria-hidden color="currentColor" size={16} />
              ) : (
                <ChevronLeft aria-hidden color="currentColor" size={16} />
              )
            }
            onClick={() => onChange(value.clone().subtract(1, "month"))}
          />
          <Button
            aria-label={t("nextMonth")}
            icon={
              rtl ? (
                <ChevronLeft aria-hidden color="currentColor" size={16} />
              ) : (
                <ChevronRight aria-hidden color="currentColor" size={16} />
              )
            }
            onClick={() => onChange(value.clone().add(1, "month"))}
          />
        </Flex>
      </Flex>
    );
  };

  useEffect(() => {
    void (async () => {
      await fetchData();
    })();

    return cancelDates;
  }, [cancelDates, fetchData]);

  if (!dates) return loading ? <Spin fullscreen /> : <ErrorFallback />;

  return (
    <Row>
      <Col lg={16} md={20} xs={24} xxl={12}>
        <Card size="small" variant="borderless">
          <Calendar
            className={canUpdate ? styles.calendar : undefined}
            defaultValue={(
              dayjs().calendar(language.calendar) as unknown as Dayjs
            ).locale(language.code)}
            disabledDate={(date) => date.isBefore(dayjs().startOf("day"))}
            fullCellRender={fullCellRender}
            fullscreen={false}
            headerRender={renderHeader}
            key={`${language.calendar}:${language.code}`}
            onSelect={(date, info) => void handleSelect(date, info)}
          />
        </Card>
      </Col>
      {loading && <Spin fullscreen />}
    </Row>
  );
};
