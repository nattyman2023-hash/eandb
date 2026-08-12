import { useEffect, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Armchair, Users, UserCog, DollarSign, 
  BarChart3, Settings, LogOut, Scissors, Package, ClipboardList, 
  MessageSquare, FileText, Target, Receipt, ClipboardCheck, BookOpen, ShoppingBag, HardDrive } from "lucide-react";
import { api } from "@/lib/apiClient";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar } from
"@/components/ui/sidebar";

const groups = [
  {
    label: "Command Centre",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Calendar", url: "/calendar", icon: CalendarDays },
      { title: "Chairs & Stations", url: "/chairs", icon: Armchair },
      { title: "Appointments", url: "/jobs", icon: ClipboardList },
      { title: "Waitlist", url: "/waitlist", icon: ClipboardCheck },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Clients", url: "/customers", icon: Users },
      { title: "Staff", url: "/employees", icon: UserCog },
      { title: "Messages", url: "/messages", icon: MessageSquare },
      { title: "Leads", url: "/leads", icon: Target },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Services", url: "/service-manager", icon: BookOpen },
      { title: "Inventory", url: "/inventory", icon: Package },
    ],
  },
  {
    label: "Shop",
    items: [
      { title: "Products", url: "/products", icon: ShoppingBag },
      { title: "Orders", url: "/orders", icon: ClipboardList },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Payroll", url: "/payroll", icon: DollarSign },
      { title: "Expenses", url: "/expenses", icon: Receipt },
      { title: "Reports", url: "/reports", icon: BarChart3 },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Settings", url: "/settings", icon: Settings },
      { title: "Cache & Updates", url: "/cache-diagnostics", icon: HardDrive },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, profile } = useAuth();
  const [pendingLeave, setPendingLeave] = useState(0);

  useEffect(() => {
    api.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending").then(({ count }) => {
      setPendingLeave(count ?? 0);
    });
  }, []);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Scissors className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary font-serif">Wub Hair</span>
              <span className="text-xs text-sidebar-foreground/60">Salon CRM</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map(group => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(item => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        className="hover:bg-sidebar-accent/50 relative"
                        activeClassName="bg-sidebar-accent text-primary font-medium before:absolute before:right-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-l before:bg-primary"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed && profile && (
          <p className="mb-2 truncate text-xs text-sidebar-foreground/60">{profile.email}</p>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-destructive hover:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
