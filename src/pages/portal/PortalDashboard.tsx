import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { Link } from "react-router-dom";
import { CalendarIcon, Star, Gift, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { format, differenceInDays } from "date-fns";
import type { Job } from "@/types/database";

const PortalDashboard = () => {
  const { user, profile } = useAuth();
  const [nextJob, setNextJob] = useState<Job | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [lastService, setLastService] = useState<string>("");
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: cust } = await api.from("customers").select("id, name").eq("user_id", user.id).single();
      if (!cust) return;
      setCustomerName(cust.name || profile?.full_name || "");

      const { data: upcoming } = await api.from("jobs")
        .select("*")
        .eq("customer_id", cust.id)
        .gte("scheduled_at", new Date().toISOString())
        .neq("status", "completed")
        .neq("status", "paid")
        .order("scheduled_at", { ascending: true })
        .limit(1);
      if (upcoming?.[0]) setNextJob(upcoming[0] as unknown as Job);

      const { count } = await api.from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", cust.id)
        .in("status", ["completed", "paid"]);
      setCompletedCount(count ?? 0);

      const { data: last } = await api.from("jobs")
        .select("notes, service_type")
        .eq("customer_id", cust.id)
        .in("status", ["completed", "paid"])
        .order("completed_at", { ascending: false })
        .limit(1);
      if (last?.[0]) setLastService(last[0].notes || last[0].service_type);
    };
    load();
  }, [user]);

  const firstName = customerName.split(" ")[0] || profile?.full_name?.split(" ")[0] || "there";
  const loyaltyPoints = completedCount;
  const loyaltyGoal = 10;
  const loyaltyProgress = Math.min((loyaltyPoints / loyaltyGoal) * 100, 100);
  const daysUntilNext = nextJob?.scheduled_at ? differenceInDays(new Date(nextJob.scheduled_at), new Date()) : null;

  return (
    <div className="space-y-8 pb-20">
      {/* Greeting */}
      <div className="pt-4">
        <h1 className="text-3xl font-serif text-[#1A2B42]">
          Hello, <span className="text-[#A68966]">{firstName}</span>.
        </h1>
        {nextJob ? (
          <p className="text-[#6B7280] mt-1">
            Your next appointment is{" "}
            {daysUntilNext !== null && daysUntilNext <= 0
              ? "today"
              : `in ${daysUntilNext} day${daysUntilNext === 1 ? "" : "s"}`}
            .
          </p>
        ) : (
          <p className="text-[#6B7280] mt-1">You have no upcoming appointments. Ready to book?</p>
        )}
      </div>

      {/* Next Appointment Card */}
      {nextJob && (
        <div className="bg-[#1A2B42] text-white rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#A68966]/20 rounded-bl-full" />
          <p className="text-xs uppercase tracking-widest text-[#A68966] mb-2">Next Appointment</p>
          <p className="text-xl font-serif">{nextJob.notes || nextJob.service_type}</p>
          <div className="flex items-center gap-2 mt-3 text-sm text-white/70">
            <CalendarIcon className="h-4 w-4" />
            {nextJob.scheduled_at && format(new Date(nextJob.scheduled_at), "EEEE, MMMM do 'at' h:mm a")}
          </div>
          <div className="mt-4 flex gap-2">
            <Link to="/portal/bookings">
              <Button size="sm" className="bg-[#A68966] hover:bg-[#8B7355] text-white">
                Manage Booking
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Book Again */}
        <Link to="/book" className="block">
          <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1A2B42]">Book Again</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  {lastService ? `Rebook "${lastService}"` : "Schedule your next visit"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[#A68966]/10 flex items-center justify-center group-hover:bg-[#A68966]/20 transition-colors">
                <Sparkles className="h-5 w-5 text-[#A68966]" />
              </div>
            </div>
          </div>
        </Link>

        {/* Refer a Friend */}
        <div className="bg-white border-2 border-[#A68966]/30 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#1A2B42]">Refer a Friend</p>
              <p className="text-xs text-[#6B7280] mt-1">Earn a free treatment when they visit</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-[#A68966]/10 flex items-center justify-center">
              <Gift className="h-5 w-5 text-[#A68966]" />
            </div>
          </div>
        </div>
      </div>

      {/* Loyalty Card */}
      <div className="bg-gradient-to-br from-[#1A2B42] to-[#2A3B52] rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#A68966]">Loyalty Rewards</p>
            <p className="text-lg font-serif mt-1">
              {loyaltyPoints} / {loyaltyGoal} visits
            </p>
          </div>
          <Star className="h-8 w-8 text-[#A68966]" />
        </div>
        <Progress value={loyaltyProgress} className="h-2 bg-white/10" />
        <p className="text-xs text-white/60 mt-3">
          {loyaltyPoints >= loyaltyGoal
            ? "🎉 You've earned a free treatment! Mention it at your next visit."
            : `${loyaltyGoal - loyaltyPoints} more visit${loyaltyGoal - loyaltyPoints === 1 ? "" : "s"} until your free treatment`}
        </p>
        {/* Stamp dots */}
        <div className="flex gap-2 mt-4">
          {Array.from({ length: loyaltyGoal }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full ${i < loyaltyPoints ? "bg-[#A68966]" : "bg-white/20"}`}
            />
          ))}
        </div>
      </div>

      {/* Recent Visit */}
      {lastService && (
        <div className="bg-white border border-[#E8E4DD] rounded-2xl p-5">
          <p className="text-xs uppercase tracking-widest text-[#A68966] mb-2">Last Visit</p>
          <p className="text-sm text-[#1A2B42] font-medium">{lastService}</p>
          <Link to="/portal/style-diary" className="text-xs text-[#A68966] flex items-center gap-1 mt-2 hover:underline">
            View Style Diary <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default PortalDashboard;
