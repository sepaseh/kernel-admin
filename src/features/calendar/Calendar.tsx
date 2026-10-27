import "@/shared/i18n/date";

import type { CalendarProps } from "antd";
import { Button, Calendar, Card, Col, Flex, Row, Select, Spin } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PropsWithChildren, ReactElement } from "react";
import { cloneElement, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAntd, useCore } from "@/app/hooks";
import { getRoutePermissions } from "@/app/lib";
import {
  isCurrentMutationError,
  useMutationRequest,
  useReadResource,
} from "@/shared/hooks";
import { getErrorMessage } from "@/shared/lib";
import { RequestFeedback } from "@/shared/ui/request-feedback";

import {
  createCalendarDate,
  deleteCalendarDate,
  fetchCalendarDates,
} from "./api";
import { useCalendarStyles } from "./styles";

type CalendarCell = ReactElement<PropsWithChildren<{ className?: string }>>;
type CalendarSelectInfo = Parameters<
  NonNullable<CalendarProps<Dayjs>["onSelect"]>
>[1];

const formatCalendarDate = (date: Dayjs) =>
  (date.calendar("gregory") as unknown as Dayjs).format("YYYY-MM-DD");

export const CalendarPage = () => {
  const { t } = useTranslation();
  const [submittingDate, setSubmittingDate] = useState<string>();
  const { messageAPI, token } = useAntd();
  const { language, user } = useCore();
  const rtl = language.direction === "rtl";
  const calendar =
    language.calendar === "gregorian" ? "gregory" : language.calendar;
  const dateLocale = language.code === "en" ? "en-gb" : language.code;
  const { canUpdate } = getRoutePermissions("calendar", user);
  const mutation = useMutationRequest(
    `${user?.id}:${calendar}:${dateLocale}`,
    canUpdate,
  );
  const { styles } = useCalendarStyles();
  const resource = useReadResource(fetchCalendarDates);
  const dates = resource.data ?? [];
  const loading = resource.loading;
  const fetchData = resource.reload;

  const { months, years } = useMemo(() => {
    const currentYear = (dayjs().calendar(calendar) as unknown as Dayjs).year();

    return {
      months: Array.from({ length: 12 }, (_, index) => ({
        label: (dayjs().calendar(calendar) as unknown as Dayjs)
          .locale(dateLocale)
          .month(index)
          .format("MMMM"),
        value: index,
      })),
      years: Array.from({ length: 12 }, (_, index) => ({
        label: currentYear + index,
        value: currentYear + index,
      })),
    };
  }, [calendar, dateLocale]);

  const handleSelect = async (
    date: Dayjs,
    selectInfo: CalendarSelectInfo,
  ): Promise<void> => {
    if (
      !canUpdate ||
      loading ||
      resource.error ||
      selectInfo.source !== "date" ||
      mutation.submitting
    )
      return;

    const formattedDate = formatCalendarDate(date);

    try {
      const result = await mutation.run((signal) => {
        setSubmittingDate(formattedDate);
        return dates.includes(formattedDate)
          ? deleteCalendarDate(formattedDate, signal)
          : createCalendarDate(formattedDate, signal);
      });
      if (!result?.isCurrent()) return;

      void messageAPI.success(t("calendarUpdated"));
      await fetchData();
    } catch (error) {
      if (isCurrentMutationError(error))
        void messageAPI.error(getErrorMessage(error.cause));
    }
  };

  const fullCellRender: CalendarProps<Dayjs>["fullCellRender"] = (
    date,
    info,
  ) => {
    if (info.type !== "date") return info.originNode;

    const formattedDate = formatCalendarDate(date);
    const originNode = info.originNode as CalendarCell;

    return cloneElement(originNode, {
      className: [
        styles.cell,
        dates.includes(formattedDate) ? styles.holiday : undefined,
      ]
        .filter(Boolean)
        .join(" "),
      children:
        mutation.submitting && submittingDate === formattedDate ? (
          <Spin size="small" />
        ) : (
          date.date()
        ),
    });
  };

  const renderHeader: CalendarProps<Dayjs>["headerRender"] = ({
    onChange,
    value,
  }) => {
    const hasPreviousMonth = value.isAfter(
      (dayjs().calendar(calendar) as unknown as Dayjs).startOf("year"),
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

  return (
    <Row>
      <Col lg={16} md={20} xs={24} xxl={12}>
        <RequestFeedback
          error={resource.error}
          hasData={!!resource.data}
          loading={loading}
          retry={resource.reload}
        />
        {(!resource.error || resource.data) && (
          <Card size="small" variant="borderless">
            <Calendar
              className={canUpdate ? styles.calendar : undefined}
              defaultValue={(
                dayjs().calendar(calendar) as unknown as Dayjs
              ).locale(dateLocale)}
              disabledDate={(date) => date.isBefore(dayjs().startOf("day"))}
              fullCellRender={fullCellRender}
              fullscreen={false}
              headerRender={renderHeader}
              key={`${calendar}:${dateLocale}`}
              onSelect={(date, info) => void handleSelect(date, info)}
            />
          </Card>
        )}
      </Col>
      {loading && <Spin fullscreen />}
    </Row>
  );
};
