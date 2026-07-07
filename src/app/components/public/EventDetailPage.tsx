import { useParams, useNavigate, Navigate } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { useEvent, useEventRegistrationCount } from "../../../hooks/useEvents";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { NavBar } from "../shared/NavBar";
import { NAVY, GOLD, parseOrgWebsite } from "../../../lib/constants";
import { Calendar, MapPin, Users, ChevronLeft, ShieldAlert } from "lucide-react";
import { LoadingScreen } from "../shared/LoadingScreen";
import { getTenantBase } from "../../../lib/subdomain";

export function EventDetailPage() {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const navigate = useNavigate();
  const base = getTenantBase(slug);
  const { organization, loading: tenantLoading } = useTenant();
  const { data: event, isLoading: eventLoading, error } = useEvent(id);
  const { data: regCount, isLoading: countLoading } = useEventRegistrationCount(id);

  const loading = tenantLoading || eventLoading;

  if (loading) {
    return <LoadingScreen variant="blue" />;
  }

  const { activeEventId } = parseOrgWebsite(organization?.website || null);
  const isActiveEvent = activeEventId === event?.id;

  // Redirect directly to the registration form only if the event is active
  if (event && isActiveEvent) {
    return <Navigate to={`${base}/register/${event.id}`} replace />;
  }

  if (error || !event) {
    return (
      <div className="min-h-screen pt-24 pb-12 bg-background">
        <NavBar organization={organization} currentPath={window.location.pathname} />
        <div className="max-w-xl mx-auto px-4">
          <PageCard className="text-center flex flex-col items-center gap-4">
            <ShieldAlert className="w-12 h-12 text-destructive" />
            <h1 className="text-xl font-bold" style={{ color: NAVY }}>Event Not Found</h1>
            <p className="text-muted-foreground text-sm">
              We couldn't retrieve the details for this event. It might have been deleted or set back to draft.
            </p>
            <GoldButton onClick={() => navigate(`${base}/events`)} className="w-full justify-center">
              Back to Events
            </GoldButton>
          </PageCard>
        </div>
      </div>
    );
  }

  const isSoldOut = event.capacity ? (regCount ?? 0) >= event.capacity : false;

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <NavBar organization={organization} currentPath={window.location.pathname} />

      <div className="max-w-3xl mx-auto px-4">
        <button
          onClick={() => navigate(`${base}/events`)}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ChevronLeft size={16} /> Back to events
        </button>

        {event.cover_image_url && (
          <div className="w-full h-64 md:h-80 rounded-2xl overflow-hidden shadow-sm mb-6 bg-muted">
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <PageCard>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span
              className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
              style={{ backgroundColor: `${GOLD}20`, color: GOLD }}
            >
              {event.type || "General"}
            </span>
            {event.capacity && (
              <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                Capacity: {event.capacity}
              </span>
            )}
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              Registered: {countLoading ? "..." : regCount}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black mb-6" style={{ color: NAVY, fontFamily: "var(--font-sans)" }}>
            {event.title}
          </h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 py-6 border-y border-border">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 mt-0.5" style={{ color: GOLD }} />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Date & Time</p>
                <p className="text-sm font-semibold mt-1">
                  {new Date(event.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(event.date).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {event.location && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 mt-0.5" style={{ color: GOLD }} />
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Venue Location</p>
                  <p className="text-sm font-semibold mt-1">{event.location}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 mt-0.5" style={{ color: GOLD }} />
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Capacity</p>
                <p className="text-sm font-semibold mt-1">
                  {event.capacity ? `${event.capacity} attendees max` : "Open entry"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isSoldOut ? "Fully booked" : `${event.capacity ? event.capacity - (regCount ?? 0) : "Unlimited"} spots left`}
                </p>
              </div>
            </div>
          </div>

          {event.description && (
            <div className="mb-8">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3" style={{ fontFamily: "var(--font-sans)" }}>
                About This Event
              </h3>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-muted/40 p-4 rounded-xl">
            <div className="text-center sm:text-left">
              {!isActiveEvent ? (
                <>
                  <p className="text-xs text-rose-600 font-bold uppercase tracking-wider">Registration Closed</p>
                  <p className="text-sm font-semibold mt-0.5">Registration is only open on-site during the live event.</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">On-Site Registration Open</p>
                  <p className="text-sm font-semibold mt-0.5">Please register your attendance now.</p>
                </>
              )}
            </div>
            <GoldButton
              onClick={() => navigate(`${base}/register/${event.id}`)}
              disabled={!isActiveEvent || isSoldOut || event.status !== "published"}
              className="w-full sm:w-auto justify-center"
            >
              {event.status !== "published"
                ? "Not Open"
                : !isActiveEvent
                ? "Registration Closed"
                : isSoldOut
                ? "Event Sold Out"
                : "Register Attendance"}
            </GoldButton>
          </div>
        </PageCard>
      </div>
    </div>
  );
}
