import {
  BriefcaseBusiness,
  Building2,
  History,
  LayoutDashboard,
  ShieldCheck,
  ToggleLeft,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/core/module-registry";

const ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  briefcase: BriefcaseBusiness,
  building: Building2,
  users: Users,
  shield: ShieldCheck,
  toggle: ToggleLeft,
  history: History,
};

export function NavIcon({
  name,
  size = 18,
  className,
}: {
  name: NavIconName;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[name];

  return <Icon aria-hidden="true" size={size} className={className} />;
}
