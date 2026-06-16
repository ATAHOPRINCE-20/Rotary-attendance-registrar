import { ReactNode } from "react";

export function PageCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-2xl shadow-sm border border-border p-6 ${className}`}>
      {children}
    </div>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pt-20">
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-xs font-bold tracking-widest uppercase mb-2"
      style={{ color: "#F7A81B", fontFamily: "Montserrat, sans-serif" }}
    >
      {children}
    </p>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className="text-2xl sm:text-3xl font-black"
      style={{ color: "#17458F", fontFamily: "Montserrat, sans-serif" }}
    >
      {children}
    </h1>
  );
}

export function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-foreground" style={{ fontFamily: "Montserrat, sans-serif" }}>
        {label}{required && <span style={{ color: "#F7A81B" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

export function TextInput({
  label, type = "text", placeholder, value, onChange, required, name,
}: {
  label: string; type?: string; placeholder?: string;
  value?: string; onChange?: (v: string) => void;
  required?: boolean; name?: string;
}) {
  return (
    <FieldGroup label={label} required={required}>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-2 transition-all"
      />
    </FieldGroup>
  );
}

export function SelectInput({
  label, options, value, onChange,
}: {
  label: string; options: { value: string; label: string }[];
  value?: string; onChange?: (v: string) => void;
}) {
  return (
    <FieldGroup label={label}>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="px-4 py-3 rounded-xl border border-border bg-input-background text-foreground text-sm focus:outline-none focus:ring-2 transition-all appearance-none"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </FieldGroup>
  );
}
