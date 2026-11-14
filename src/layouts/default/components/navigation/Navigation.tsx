import { Menu, type MenuProps } from "antd";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { routeTree, type NavigationItem, type RouteKey } from "@/app/config";

type NavigationProps = Pick<
  MenuProps,
  "builtinPlacements" | "mode" | "onClick" | "style"
> & {
  currentRoute: RouteKey;
  items: readonly NavigationItem[];
};

const createMenuItems = (
  items: readonly NavigationItem[],
  t: TFunction,
): MenuProps["items"] =>
  items.map((item) => {
    if ("route" in item) {
      const { label, path } = routeTree[item.route];
      return {
        key: item.route,
        label: <Link to={path}>{t(label)}</Link>,
      };
    }

    return {
      children: createMenuItems(item.children, t),
      key: item.key,
      label: t(item.label),
    };
  });

export const Navigation = ({
  currentRoute,
  items,
  ...props
}: NavigationProps) => {
  const { t } = useTranslation();
  return (
    <Menu
      {...props}
      items={createMenuItems(items, t)}
      selectedKeys={[currentRoute]}
    />
  );
};
