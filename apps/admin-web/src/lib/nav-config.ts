import {
  BarChart3,
  Banknote,
  BookOpen,
  Building2,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Dumbbell,
  ExternalLink,
  Flag,
  GraduationCap,
  Inbox,
  Layers,
  LayoutDashboard,
  ListOrdered,
  Mail,
  MapPin,
  Medal,
  MessagesSquare,
  Receipt,
  RefreshCw,
  Settings,
  Swords,
  Trophy,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

// Grouping per product direction (2026-07): operations first, then scheduling
// and curriculum, Match Center, people, money — communications toward the end.
export const NAV_SECTIONS: NavSection[] = [
  { label: "", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "Academy/School Operations",
    items: [
      { label: "Plans", href: "/academy/plans", icon: ClipboardList },
      { label: "Classes", href: "/academy/classes", icon: GraduationCap },
      { label: "Enquiries", href: "/academy/enquiries", icon: Inbox },
      { label: "Students", href: "/academy/clients", icon: Users },
      { label: "Schools", href: "/academy/schools", icon: Building2 },
      { label: "Centers", href: "/academy/centers", icon: MapPin },
      { label: "Attendance", href: "/academy/attendance", icon: UserCheck },
    ],
  },
  {
    label: "Scheduling",
    items: [
      { label: "Class Schedule", href: "/academy/schedule", icon: CalendarDays },
      { label: "Timetables", href: "/misc/timetables", icon: CalendarRange },
    ],
  },
  {
    label: "Multisport Curriculum & Assessment",
    items: [
      { label: "Lesson Plans", href: "/misc/lesson-plans", icon: BookOpen },
      { label: "Drill Bank", href: "/misc/drill-bank", icon: Dumbbell },
      { label: "Curriculum", href: "/misc/curriculum", icon: ListOrdered },
      { label: "Grades", href: "/misc/grades", icon: Layers },
    ],
  },
  {
    label: "Tournaments",
    items: [
      // Admin creates tournaments here, then hands them to an organizer.
      { label: "Whistle - Tournaments", href: "/tournaments", icon: Flag },
      // Standalone portal for the organizers who run them (shareable URL).
      { label: "Organizer Portal", href: "/organizer", icon: ExternalLink },
    ],
  },
  {
    label: "Match Center",
    items: [
      { label: "Events", href: "/interschool/events", icon: Trophy },
      { label: "Invitations", href: "/interschool/invitations", icon: Mail },
      { label: "Fixtures", href: "/interschool/fixtures", icon: Swords },
      { label: "Member Schools", href: "/interschool/member-schools", icon: Building2 },
      { label: "Whistle Standings", href: "/interschool/ratings", icon: Medal },
    ],
  },
  {
    label: "Users",
    items: [
      { label: "Staff", href: "/staff/users", icon: UserCog },
      { label: "Staff Attendance", href: "/staff/attendance", icon: UserCheck },
      { label: "Salary", href: "/staff/salary", icon: Wallet },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Invoices", href: "/sales/invoices", icon: Receipt },
      { label: "Renewals", href: "/academy/renewals", icon: RefreshCw },
      { label: "Expenses", href: "/expenses", icon: Banknote },
    ],
  },
  {
    label: "Communications",
    items: [{ label: "Chat / Notice Board / WhatsApp", href: "/communication", icon: MessagesSquare }],
  },
  { label: "", items: [{ label: "Reports", href: "/reports", icon: BarChart3 }] },
  { label: "", items: [{ label: "Settings", href: "/settings", icon: Settings }] },
];
