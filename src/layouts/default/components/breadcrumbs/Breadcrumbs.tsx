import { Breadcrumb } from "antd";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { routeTree, type NavigationItem, type RouteKey } from "@/app/config";
import { useAntd } from "@/app/hooks";

type BreadcrumbsProps = {
  currentRoute: RouteKey;
  items: readonly NavigationItem[];
};

const findBreadcrumbItems = (
  items: readonly NavigationItem[],
  currentRoute: RouteKey,
  t: TFunction,
): { title: string }[] | undefined => {
  for (const item of items) {
    if ("route" in item) {
      if (item.route === currentRoute) {
        return [{ title: t(routeTree[item.route].label) }];
      }

      continue;
    }

    const children = findBreadcrumbItems(item.children, currentRoute, t);
    if (children) return [{ title: t(item.label) }, ...children];
  }
};

export const Breadcrumbs = ({ currentRoute, items }: BreadcrumbsProps) => {
  const { t } = useTranslation();
  const { token } = useAntd();
  const currentRouteConfig = routeTree[currentRoute];
  const currentBreadcrumbItems =
    findBreadcrumbItems(items, currentRoute, t) ??
    ("label" in currentRouteConfig
      ? [{ title: t(currentRouteConfig.label) }]
      : []);
  const breadcrumbItems =
    currentRoute === "root"
      ? currentBreadcrumbItems
      : [
          {
            title: (
              <Link to={routeTree.root.path}>{t(routeTree.root.label)}</Link>
            ),
          },
          ...currentBreadcrumbItems,
        ];

  return (
    <Breadcrumb
      aria-label={t("breadcrumb")}
      items={breadcrumbItems}
      style={{ marginBottom: token.marginMD }}
    />
  );
};
