import { useNavigate } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { useAdminEvents } from "../../../hooks/useEvents";
import { useOrgRegistrations } from "../../../hooks/useRegistrations";
import { useOrgDonations } from "../../../hooks/useDonations";
import { PageCard } from "../shared/PageCard";
import { AdminLayout } from "../shared/AdminLayout";
import { NAVY, GOLD, DONATION_CATEGORIES } from "../../../lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { TrendingUp, Users, Heart, Award, BarChart3 } from "lucide-react";

import { LoadingScreen } from "../shared/LoadingScreen";

export function AnalyticsPage() {
  const { organization } = useAuth();
  const navigate = useNavigate();

  // Queries
  const { data: events, isLoading: eventsLoading } = useAdminEvents(organization?.id);
  const { data: registrations, isLoading: regsLoading } = useOrgRegistrations(organization?.id);
  const { data: donations, isLoading: donationsLoading } = useOrgDonations(organization?.id);

  const loading = eventsLoading || regsLoading || donationsLoading;

  if (loading) {
    return <LoadingScreen variant="light" />;
  }

  // 1. Process registrations stats
  const checkedInCount = registrations?.filter(r => r.status === "checked-in").length ?? 0;

  // 2. Process donations stats
  const totalDonationAmount = donations?.reduce((acc, curr) => acc + Number(curr.amount), 0) ?? 0;

  // 3. Prepare data for: Attendees per Event (Bar Chart)
  const eventAttendanceData = events?.map(ev => {
    const eventCheckedIn = registrations?.filter((r: any) => r.event_id === ev.id && r.status === "checked-in").length ?? 0;
    return {
      name: ev.title.length > 15 ? `${ev.title.slice(0, 15)}...` : ev.title,
      "Attendees": eventCheckedIn,
    };
  }) ?? [];

  // 4. Prepare data for: Donation category breakdown (Bar Chart)
  const donationCategoriesData = DONATION_CATEGORIES.map(cat => {
    const sum = donations?.filter(d => d.category === cat.id).reduce((acc, curr) => acc + Number(curr.amount), 0) ?? 0;
    return {
      category: cat.label.length > 20 ? `${cat.label.slice(0, 20)}...` : cat.label,
      Amount: sum,
    };
  });

  return (
    <AdminLayout pageTitle="Analytics">
      <div className="mb-6">
        <h1 className="text-2xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review stats on check-ins, attendee metrics, and donation campaign metrics.</p>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <PageCard className="flex items-center gap-4">
                <div className="p-3 bg-[#17458F]/10 text-[#17458F] rounded-xl">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Total Attendees</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{checkedInCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Checked-in across all events</p>
                </div>
              </PageCard>

              <PageCard className="flex items-center gap-4">
                <div className="p-3 bg-[#F7A81B]/10 text-[#F7A81B] rounded-xl">
                  <Heart size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Total Raised</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>UGX {totalDonationAmount.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Overall voluntary donations</p>
                </div>
              </PageCard>

              <PageCard className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Active Events</p>
                  <p className="text-xl font-black mt-0.5" style={{ color: NAVY }}>{events?.length ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">In club database</p>
                </div>
              </PageCard>
      </div>

      <div className="flex flex-col gap-6">
              {/* Event RSVPs checkins chart */}
              <PageCard>
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-1.5 border-b border-border pb-2">
                  <BarChart3 size={16} /> Attendance per Event
                </h3>

                {eventAttendanceData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">Add events to view attendance analytics.</p>
                ) : (
                  <div className="h-80 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={eventAttendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Attendees" fill="#17458F" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </PageCard>

              {/* Donations allocation breakdown chart */}
              <PageCard>
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-1.5 border-b border-border pb-2">
                  <Heart size={16} /> Donations Breakdown by Allocation
                </h3>

                <div className="h-80 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={donationCategoriesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="category" />
                      <YAxis tickFormatter={(val) => `UGX ${Number(val).toLocaleString()}`} />
                      <Tooltip formatter={(value) => [`UGX ${Number(value).toLocaleString()}`, "Raised"]} />
                      <Bar dataKey="Amount" fill="#0067C8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </PageCard>
      </div>
    </AdminLayout>
  );
}
