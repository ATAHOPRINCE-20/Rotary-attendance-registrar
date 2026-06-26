import { useNavigate, useParams } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { usePublicEvents } from "../../../hooks/useEvents";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD } from "../../../lib/constants";
import { Calendar, MapPin, Tag, ArrowRight } from "lucide-react";
import { LoadingScreen } from "../shared/LoadingScreen";

export function EventsListPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { organization, loading: tenantLoading } = useTenant();
  const { data: events, isLoading: eventsLoading } = usePublicEvents(organization?.id);

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
          <h1 className="text-3xl font-black" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
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
            <OutlineButton onClick={() => navigate(`/org/${slug}`)} className="mt-4">
              Back to Home
            </OutlineButton>
          </PageCard>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {events.map((ev) => {
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
                        <h2 className="text-xl font-bold" style={{ color: NAVY, fontFamily: "Montserrat, sans-serif" }}>
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
                          <span className="flex items-center gap-1.5">
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
                            onClick={() => navigate(`/org/${slug}/event/${ev.id}`)}
                            className="py-2 px-4 flex items-center gap-1 text-xs"
                          >
                            Details <ArrowRight size={13} />
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
      </div>
    </div>
  );
}
