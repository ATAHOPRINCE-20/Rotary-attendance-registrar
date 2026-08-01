import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { usePublicEvents } from "../../../hooks/useEvents";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD } from "../../../lib/constants";
import { Calendar, MapPin, Tag, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { LoadingScreen } from "../shared/LoadingScreen";

import { getTenantBase } from "../../../lib/subdomain";

export function EventsListPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const base = getTenantBase(slug);
  const { organization, loading: tenantLoading } = useTenant();
  const { data: events, isLoading: eventsLoading } = usePublicEvents(organization?.id);

  const [showAllEvents, setShowAllEvents] = useState(false);

  const loading = tenantLoading || eventsLoading;

  if (loading) {
    return <LoadingScreen variant="blue" />;
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8 text-center sm:text-left">
          <p className="text-xs font-bold tracking-widest uppercase mb-1" style={{ color: GOLD }}>
            Upcoming Gatherings
          </p>
          <h1 className="text-3xl font-black" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            Club Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Join us in service and fellowship. Click any event to register your attendance.
          </p>
        </div>

        {!events || events.length === 0 ? (
          <PageCard className="text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-bold" style={{ color: NAVY }}>No Events Scheduled</h3>
            <p className="text-sm text-muted-foreground mt-1">
              There are currently no upcoming events listed for this club. Please check back later!
            </p>
            <OutlineButton onClick={() => navigate(base || "/")} className="mt-4">
              Back to Home
            </OutlineButton>
          </PageCard>
        ) : (() => {
          const now = Date.now();
          // Filter active & upcoming events (not closed, date is today or future)
          const activeUpcomingEvents = events
            .filter((ev) => ev.status !== "closed" && new Date(ev.date).getTime() >= now - 24 * 60 * 60 * 1000)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Closed or past events are archived
          const archivedEvents = events
            .filter((ev) => ev.status === "closed" || new Date(ev.date).getTime() < now - 24 * 60 * 60 * 1000)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const displayedUpcoming = showAllEvents ? activeUpcomingEvents : activeUpcomingEvents.slice(0, 4);

          return (
            <div className="flex flex-col gap-6">
              {activeUpcomingEvents.length === 0 ? (
                <PageCard className="text-center py-8">
                  <h3 className="text-base font-bold text-slate-700">No Active Upcoming Events</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    All previous events have been archived. New fellowships will be listed soon.
                  </p>
                </PageCard>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {displayedUpcoming.map((ev) => {
                    const eventDate = new Date(ev.date);
                    return (
                      <PageCard key={ev.id} className="overflow-hidden hover:shadow-md transition-all duration-200">
                        <div className="flex flex-col sm:flex-row gap-6">
                          {ev.cover_image_url && (
                            <div className="w-full sm:w-48 h-32 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                              <img
                                src={ev.cover_image_url}
                                alt={ev.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 flex flex-col justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span
                                  className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
                                >
                                  {ev.type || "General"}
                                </span>
                                {ev.capacity && (
                                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    Limit: {ev.capacity}
                                  </span>
                                )}
                              </div>
                              <h2 className="text-xl font-bold" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
                                {ev.title}
                              </h2>
                              {ev.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {ev.description}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border">
                              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Calendar size={13} style={{ color: GOLD }} />
                                  {eventDate.toLocaleDateString("en-US", {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })} at {eventDate.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {ev.location && (
                                  <span className="flex items-center gap-1.5">
                                    <MapPin size={13} style={{ color: GOLD }} />
                                    {ev.location}
                                  </span>
                                )}
                              </div>

                              <div className="flex gap-2">
                                <GoldButton
                                  onClick={() => navigate(`${base}/event/${ev.id}`)}
                                  className="py-2 px-4 flex items-center gap-1 text-xs font-bold"
                                >
                                  View Details <ArrowRight size={13} />
                                </GoldButton>
                              </div>
                            </div>
                          </div>
                        </div>
                      </PageCard>
                    );
                  })}
                </div>
              )}

              {activeUpcomingEvents.length > 4 && (
                <div className="flex justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllEvents(!showAllEvents)}
                    className="px-6 py-2.5 rounded-xl border border-border bg-white hover:bg-slate-50 text-xs font-bold text-[#17458F] transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    {showAllEvents ? (
                      <>Show Less <ChevronUp size={14} /></>
                    ) : (
                      <>Show More Upcoming Events ({activeUpcomingEvents.length - 4} more) <ChevronDown size={14} /></>
                    )}
                  </button>
                </div>
              )}

              {/* Archived & Closed Past Events Section */}
              {archivedEvents.length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                        Archived / Closed Events ({archivedEvents.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">Past and completed club fellowships</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 opacity-75">
                    {archivedEvents.map((ev) => {
                      const eventDate = new Date(ev.date);
                      return (
                        <div key={ev.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                                Archived
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                {eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <h4 className="text-base font-bold text-slate-800 mt-1">{ev.title}</h4>
                          </div>

                          <OutlineButton
                            onClick={() => navigate(`${base}/event/${ev.id}`)}
                            className="text-xs py-1.5 px-3 font-semibold"
                          >
                            View Summary
                          </OutlineButton>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
