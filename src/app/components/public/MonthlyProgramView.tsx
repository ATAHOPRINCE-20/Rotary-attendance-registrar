import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { useTenant } from "../../../context/TenantContext";
import { usePublicEvents } from "../../../hooks/useEvents";
import { PageCard } from "../shared/PageCard";
import { GoldButton, OutlineButton } from "../shared/Buttons";
import { LoadingScreen } from "../shared/LoadingScreen";
import { NAVY, parseOrgWebsite } from "../../../lib/constants";
import { getTenantBase } from "../../../lib/subdomain";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Mic, 
  Users,
  BookOpen,
  ArrowRight,
  Quote
} from "lucide-react";
import type { Event } from "../../../types/database";

const ROTARY_MONTHLY_THEMES: Record<number, { theme: string; description: string }> = {
  0: { theme: "Vocational Service Month", description: "Promoting high ethical standards in businesses and professions, recognizing the worthiness of all useful occupations." },
  1: { theme: "Peacebuilding and Conflict Prevention Month", description: "Fostering understanding and peace through service, dialogue, and conflict resolution initiatives." },
  2: { theme: "Water, Sanitation, and Hygiene Month", description: "Providing clean water, sanitation facilities, and hygiene education to communities in need." },
  3: { theme: "Maternal and Child Health Month", description: "Ensuring high-quality healthcare to vulnerable mothers and children to build stronger futures." },
  4: { theme: "Youth Service Month", description: "Empowering young leaders through Interact, Rotaract, RYLA, and youth exchange programs." },
  5: { theme: "Rotary Fellowship Month", description: "Celebrating international fellowship and strategic partnerships across Rotary globally." },
  6: { theme: "Maternal & Child Health & Leadership Month", description: "Focusing on maternal survival, health systems, and emerging leaders." },
  7: { theme: "Membership & New Club Development Month", description: "Expanding our impact by growing club membership and starting vibrant new Rotary clubs." },
  8: { theme: "Basic Education & Literacy Month", description: "Supporting education, strengthening literacy programs, and empowering students worldwide." },
  9: { theme: "Community Economic Development Month", description: "Investing in people to create sustainable economic growth and poverty alleviation." },
  10: { theme: "The Rotary Foundation Month", description: "Supporting global grants, PolioPlus, and life-changing humanitarian programs." },
  11: { theme: "Disease Prevention & Treatment Month", description: "Fighting disease, hosting health clinics, and funding polio eradication worldwide." },
};

interface MonthlyProgramViewProps {
  hideHeaderNav?: boolean;
  organization?: any;
}

export function MonthlyProgramView({ hideHeaderNav = false, organization: propOrg }: MonthlyProgramViewProps) {
  const navigate = useNavigate();

  const { organization: tenantOrg, loading: tenantLoading } = useTenant();
  const organization = propOrg || tenantOrg;
  const { data: events, isLoading: eventsLoading } = usePublicEvents(organization?.id);

  const base = getTenantBase(organization?.slug);

  // Selected Year and Month state (default to current date)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  const { activeEventId } = parseOrgWebsite(organization?.website || null);

  const loading = propOrg ? eventsLoading : (tenantLoading || eventsLoading);

  const currentYear = selectedDate.getFullYear();
  const currentMonthIndex = selectedDate.getMonth(); // 0-indexed

  const monthName = selectedDate.toLocaleDateString("en-US", { month: "long" });

  // Filter events for selected month & year
  const monthlyEvents = useMemo(() => {
    if (!events) return [];
    return events
      .filter((ev) => {
        if (!ev.date) return false;
        const evDate = new Date(ev.date);
        return (
          evDate.getFullYear() === currentYear &&
          evDate.getMonth() === currentMonthIndex
        );
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events, currentYear, currentMonthIndex]);

  // Determine monthly theme
  const defaultThemeInfo = ROTARY_MONTHLY_THEMES[currentMonthIndex] || {
    theme: `${monthName} Fellowship Month`,
    description: "Promoting Rotary service, leadership, and fellowship in our community.",
  };

  const activeThemeTitle = organization?.monthly_theme || defaultThemeInfo.theme;
  const activeThemeDesc = organization?.monthly_theme_description || defaultThemeInfo.description;
  const activeMonthlyMessage = organization?.monthly_message;

  const handlePrevMonth = () => {
    setSelectedDate(new Date(currentYear, currentMonthIndex - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate(new Date(currentYear, currentMonthIndex + 1, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedDate(new Date());
  };

  const getGoogleCalendarUrl = (ev: Event) => {
    const start = new Date(ev.date).toISOString().replace(/-|:|\.\d+/g, "");
    const endDateObj = ev.end_date ? new Date(ev.end_date) : new Date(new Date(ev.date).getTime() + 2 * 60 * 60 * 1000);
    const end = endDateObj.toISOString().replace(/-|:|\.\d+/g, "");
    const title = encodeURIComponent(`${ev.title} - ${organization?.name || 'Rotary Club'}`);
    const details = encodeURIComponent(ev.description || ev.topic || "Weekly Fellowship Meeting");
    const location = encodeURIComponent(ev.location || "Club Venue");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
  };

  if (loading) {
    return <LoadingScreen variant="blue" />;
  }

  return (
    <div className="w-full">
      {/* Navigation Header */}
      {!hideHeaderNav && (
        <div className="flex items-center justify-between gap-4 mb-6 print:hidden">
          <button
            onClick={() => navigate(`${base}/events`)}
            className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> Back to Events
          </button>
        </div>
      )}

      {/* Club & Monthly Header Banner */}
      <div className="bg-gradient-to-br from-[#081c3b] via-[#17458F] to-[#0f2d5c] rounded-3xl p-5 sm:p-8 text-white shadow-xl mb-6 relative overflow-hidden border border-white/10">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-[#F7A81B]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 -top-10 w-56 h-56 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-4 sm:gap-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-[#F7A81B] text-[#081c3b] shadow-xs">
              Rotary Monthly Program
            </span>
            {organization?.district && (
              <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-white/10 text-blue-100 border border-white/15">
                District {organization.district}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white font-sans">
              {organization?.name || "Rotary Club"}
            </h1>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-sm flex flex-col gap-2.5">
            <div className="border-b border-white/10 pb-1.5">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider font-extrabold text-[#F7A81B]">
                Theme for {monthName} {currentYear}
              </span>
            </div>

            <div>
              <h3 className="text-base sm:text-xl font-black text-white tracking-tight">{activeThemeTitle}</h3>
              <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed mt-1">
                {activeThemeDesc}
              </p>
            </div>

            {activeMonthlyMessage && (
              <div className="mt-1 pt-2.5 border-t border-white/10 flex items-start gap-2 text-xs italic text-amber-200 bg-black/10 p-2.5 sm:p-3 rounded-xl">
                <Quote size={14} className="text-[#F7A81B] shrink-0 mt-0.5" />
                <p className="leading-relaxed">"{activeMonthlyMessage}"</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Month Selector Toolbar */}
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 mb-8 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-muted rounded-xl transition-all text-foreground border border-border flex items-center gap-1 text-xs font-bold cursor-pointer"
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">Previous</span>
          </button>

          <div className="px-4 py-1 text-center">
            <span className="block text-[9px] font-extrabold text-[#F7A81B] uppercase tracking-widest">Active Roster Month</span>
            <span className="text-sm font-black text-[#17458F]">{monthName} {currentYear}</span>
          </div>

          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-muted rounded-xl transition-all text-foreground border border-border flex items-center gap-1 text-xs font-bold cursor-pointer"
          >
            <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
          </button>
        </div>

        <button
          onClick={handleCurrentMonth}
          className="text-xs font-extrabold text-[#17458F] hover:underline cursor-pointer transition-colors px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 w-full sm:w-auto text-center"
        >
          Jump to Current Month
        </button>
      </div>

      {/* Monthly Roster List Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-xl font-black tracking-tight" style={{ color: NAVY }}>
            Fellowship & Event Schedule
          </h2>
          <p className="text-xs text-muted-foreground">
            {monthlyEvents.length} program item{monthlyEvents.length === 1 ? "" : "s"} scheduled for {monthName} {currentYear}
          </p>
        </div>
      </div>

      {/* Program Roster Items */}
      {monthlyEvents.length === 0 ? (
        <PageCard className="text-center py-12 px-6 flex flex-col items-center gap-4 bg-muted/20 border-dashed border-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <BookOpen size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground" style={{ color: NAVY }}>
              No Fellowships Listed for {monthName} {currentYear}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mt-1 leading-relaxed">
              The program roster for {monthName} is currently being finalized by the club administration. Check back soon or view upcoming events in other months.
            </p>
          </div>

          <div className="flex gap-3 mt-2 print:hidden">
            <OutlineButton onClick={handlePrevMonth} className="text-xs font-bold">
              Previous Month
            </OutlineButton>
            <GoldButton onClick={() => navigate(`${base}/events`)} className="text-xs font-bold">
              Browse All Events
            </GoldButton>
          </div>
        </PageCard>
      ) : (
        <div className="flex flex-col gap-4">
          {monthlyEvents.map((ev) => {
            const evDate = new Date(ev.date);
            const dayName = evDate.toLocaleDateString("en-US", { weekday: "short" });
            const dayNum = evDate.getDate();
            const timeStr = evDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

            const isPast = evDate.getTime() < Date.now();
            const isToday = evDate.toDateString() === new Date().toDateString();
            const isOpenForRegistration = activeEventId === ev.id;

            const speakerName = ev.fellowship_report?.guest_speaker_name || null;
            const speakerTopic = ev.fellowship_report?.guest_speaker_topic || ev.topic || null;
            const buddyGroup = ev.buddy_group_of_the_day || ev.buddy_groups || null;

            return (
              <div
                key={ev.id}
                className={`bg-card rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs hover:shadow-md ${
                  isToday
                    ? "border-[#F7A81B] ring-2 ring-[#F7A81B]/20"
                    : "border-border hover:border-[#17458F]/30"
                }`}
              >
                <div className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                  {/* Left: Date Badge & Details */}
                  <div 
                    onClick={() => {
                      if (!isOpenForRegistration) {
                        navigate(`${base}/event/${ev.id}`);
                      }
                    }}
                    className={`flex items-start gap-4 flex-1 ${!isOpenForRegistration ? "cursor-pointer group" : ""}`}
                  >
                    <div
                      className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm ${
                        isToday
                          ? "bg-[#F7A81B] text-slate-950 font-black"
                          : isPast
                          ? "bg-slate-100 text-slate-500 border border-slate-200"
                          : "bg-[#17458F] text-white"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold tracking-wider">{dayName}</span>
                      <span className="text-2xl font-black leading-none mt-0.5">{dayNum}</span>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isToday && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                            Happening Today
                          </span>
                        )}
                        {isOpenForRegistration ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Open for On-Site Check-In
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Upcoming Fellowship
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize bg-primary/10 text-primary border border-primary/20">
                          {ev.type || "Fellowship"}
                        </span>
                      </div>

                      <h3 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${base}/event/${ev.id}`);
                        }}
                        className="text-base sm:text-lg font-bold leading-tight hover:underline hover:text-[#17458F] cursor-pointer transition-colors" 
                        style={{ color: NAVY }}
                      >
                        {ev.title}
                      </h3>

                      {speakerTopic && speakerTopic !== ev.title && (
                        <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg w-fit">
                          Topic: "{speakerTopic}"
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-[#17458F] gap-x-4 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock size={14} className="text-[#17458F]" /> {timeStr}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin size={14} className="text-[#17458F]" /> {ev.location}
                          </span>
                        )}
                        {buddyGroup && (
                          <span className="flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Users size={12} className="text-[#17458F]" /> Host: {buddyGroup}
                          </span>
                        )}
                      </div>

                      {speakerName && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mt-1">
                          <Mic size={14} className="text-[#F7A81B]" /> Guest Speaker: <strong className="text-foreground">{speakerName}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0 print:hidden pt-3 sm:pt-0 border-t sm:border-t-0 border-border">
                    {isOpenForRegistration ? (
                      <GoldButton
                        onClick={() => navigate(`${base}/register/${ev.id}`)}
                        className="w-full sm:w-auto justify-center text-xs py-2.5 px-4 font-bold uppercase tracking-wider"
                      >
                        Register / Attend
                      </GoldButton>
                    ) : (
                      <OutlineButton
                        onClick={() => navigate(`${base}/event/${ev.id}`)}
                        className="w-full sm:w-auto justify-center text-xs py-2 px-4 font-bold flex items-center gap-1.5"
                      >
                        View Event Details <ArrowRight size={14} />
                      </OutlineButton>
                    )}

                    <a
                      href={getGoogleCalendarUrl(ev)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer shadow-xs"
                      title="Add to Google Calendar"
                    >
                      <CalendarIcon size={14} className="text-[#17458F]" /> Add to Google Calendar
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
