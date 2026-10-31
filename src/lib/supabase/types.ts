// Дерекқор типтері. Supabase жобасы қосылғаннан кейін автоматты генерациямен ауыстыруға болады:
//   npx supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type UserRole = "student" | "admin";
export type GradeLevel = "10" | "11" | "graduate";
export type AppLocale = "kk" | "ru";
export type DeviceRequestStatus = "pending" | "approved" | "rejected" | "used" | "blocked" | "expired";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Profile = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  nickname: string | null;
  avatar: string | null;
  grade: GradeLevel | null;
  locale: AppLocale;
  profile_pair: string;
  target_score: number | null;
  xp: number;
  level: number;
  streak: number;
  created_at: string;
  updated_at: string;
};

export type AccessGrant = {
  id: string;
  email: string;
  user_id: string | null;
  starts_at: string;
  ends_at: string;
  revoked_at: string | null;
  granted_by: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Device = {
  id: string;
  user_id: string;
  device_key: string;
  fingerprint: string;
  label: string;
  user_agent: string | null;
  last_ip: string | null;
  last_city: string | null;
  last_country: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
};

export type DeviceRequest = {
  id: string;
  user_id: string;
  device_key: string;
  fingerprint: string;
  label: string;
  user_agent: string | null;
  ip: string | null;
  city: string | null;
  country: string | null;
  status: DeviceRequestStatus;
  code_hash: string | null;
  code_expires_at: string | null;
  failed_attempts: number;
  replace_device_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SecurityEvent = {
  id: number;
  user_id: string | null;
  type: string;
  severity: "info" | "warning" | "critical";
  ip: string | null;
  city: string | null;
  country: string | null;
  user_agent: string | null;
  device_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Pick<Profile, "id" | "email"> & Partial<Profile>>;
      access_grants: Table<AccessGrant, Pick<AccessGrant, "email" | "ends_at"> & Partial<AccessGrant>>;
      devices: Table<
        Device,
        Pick<Device, "user_id" | "device_key" | "fingerprint" | "label"> & Partial<Device>
      >;
      device_requests: Table<
        DeviceRequest,
        Pick<DeviceRequest, "user_id" | "device_key" | "fingerprint" | "label"> & Partial<DeviceRequest>
      >;
      security_events: Table<
        SecurityEvent,
        Pick<SecurityEvent, "type"> & Partial<Omit<SecurityEvent, "id">>
      >;
      audit_log: Table<AuditLog, Pick<AuditLog, "action"> & Partial<Omit<AuditLog, "id">>>;
      admin_emails: Table<{ email: string }>;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      has_full_access: { Args: Record<string, never>; Returns: boolean };
      user_has_full_access: { Args: { p_user: string }; Returns: boolean };
      rate_limit_hit: { Args: { p_key: string; p_max: number; p_window_seconds: number }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      grade_level: GradeLevel;
      app_locale: AppLocale;
      device_request_status: DeviceRequestStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
