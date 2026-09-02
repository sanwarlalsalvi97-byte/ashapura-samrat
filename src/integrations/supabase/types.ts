export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          advance: number
          created_at: string
          date: string
          gps_lat: number | null
          gps_lng: number | null
          gps_status: string | null
          id: string
          in_time: string | null
          notes: string | null
          out_time: string | null
          overtime_hours: number | null
          site_name: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_at: string
          user_id: string
          worker_id: string
        }
        Insert: {
          advance?: number
          created_at?: string
          date?: string
          gps_lat?: number | null
          gps_lng?: number | null
          gps_status?: string | null
          id?: string
          in_time?: string | null
          notes?: string | null
          out_time?: string | null
          overtime_hours?: number | null
          site_name?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
          user_id: string
          worker_id: string
        }
        Update: {
          advance?: number
          created_at?: string
          date?: string
          gps_lat?: number | null
          gps_lng?: number | null
          gps_status?: string | null
          id?: string
          in_time?: string | null
          notes?: string | null
          out_time?: string | null
          overtime_hours?: number | null
          site_name?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
          user_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_logs: {
        Row: {
          accuracy_meters: number | null
          attendance_type: string
          created_at: string
          distance_meters: number | null
          face_verified: boolean
          id: string
          is_suspicious: boolean
          latitude: number | null
          log_date: string
          logged_at: string
          longitude: number | null
          notes: string | null
          office_location_id: string | null
          photo_url: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          site_name: string | null
          suspicious_reason: string | null
          user_id: string
          worker_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          attendance_type?: string
          created_at?: string
          distance_meters?: number | null
          face_verified?: boolean
          id?: string
          is_suspicious?: boolean
          latitude?: number | null
          log_date?: string
          logged_at?: string
          longitude?: number | null
          notes?: string | null
          office_location_id?: string | null
          photo_url?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          site_name?: string | null
          suspicious_reason?: string | null
          user_id?: string
          worker_id: string
        }
        Update: {
          accuracy_meters?: number | null
          attendance_type?: string
          created_at?: string
          distance_meters?: number | null
          face_verified?: boolean
          id?: string
          is_suspicious?: boolean
          latitude?: number | null
          log_date?: string
          logged_at?: string
          longitude?: number | null
          notes?: string | null
          office_location_id?: string | null
          photo_url?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          site_name?: string | null
          suspicious_reason?: string | null
          user_id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_office_location_id_fkey"
            columns: ["office_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      brick_stock: {
        Row: {
          created_at: string
          date: string
          entry_type: Database["public"]["Enums"]["brick_entry_type"]
          id: string
          notes: string | null
          quantity: number
          rate: number
          site_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          entry_type?: Database["public"]["Enums"]["brick_entry_type"]
          id?: string
          notes?: string | null
          quantity?: number
          rate?: number
          site_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          entry_type?: Database["public"]["Enums"]["brick_entry_type"]
          id?: string
          notes?: string | null
          quantity?: number
          rate?: number
          site_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cashbook: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["cashbook_category"]
          created_at: string
          date: string
          id: string
          notes: string | null
          payment_id: string | null
          site_name: string | null
          type: Database["public"]["Enums"]["cashbook_type"]
          updated_at: string
          user_id: string
          worker_id: string | null
        }
        Insert: {
          amount?: number
          category?: Database["public"]["Enums"]["cashbook_category"]
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          payment_id?: string | null
          site_name?: string | null
          type: Database["public"]["Enums"]["cashbook_type"]
          updated_at?: string
          user_id: string
          worker_id?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["cashbook_category"]
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          payment_id?: string | null
          site_name?: string | null
          type?: Database["public"]["Enums"]["cashbook_type"]
          updated_at?: string
          user_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cashbook_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbook_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          address: string | null
          advance_paid: number
          assigned_workers: string[] | null
          contract_amount: number
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          payment_mode: string | null
          phone: string | null
          progress: number
          site_name: string | null
          start_date: string | null
          status: string
          updated_at: string
          upi_id: string | null
          user_id: string
          work_type: string | null
        }
        Insert: {
          address?: string | null
          advance_paid?: number
          assigned_workers?: string[] | null
          contract_amount?: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          payment_mode?: string | null
          phone?: string | null
          progress?: number
          site_name?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          upi_id?: string | null
          user_id: string
          work_type?: string | null
        }
        Update: {
          address?: string | null
          advance_paid?: number
          assigned_workers?: string[] | null
          contract_amount?: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          payment_mode?: string | null
          phone?: string | null
          progress?: number
          site_name?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          work_type?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      office_locations: {
        Row: {
          created_at: string
          face_scan_enabled: boolean
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          face_scan_enabled?: boolean
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name?: string
          radius_meters?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          face_scan_enabled?: boolean
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          note: string | null
          payment_date: string
          payment_mode: string
          site_name: string | null
          user_id: string | null
          worker_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          note?: string | null
          payment_date?: string
          payment_mode?: string
          site_name?: string | null
          user_id?: string | null
          worker_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          note?: string | null
          payment_date?: string
          payment_mode?: string
          site_name?: string | null
          user_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          id: string
          plan: string
          premium_until: string | null
          trial_ends_at: string
          trial_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan?: string
          premium_until?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan?: string
          premium_until?: string | null
          trial_ends_at?: string
          trial_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      worker_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          note: string | null
          site_name: string | null
          updated_at: string
          user_id: string | null
          worker_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          site_name?: string | null
          updated_at?: string
          user_id?: string | null
          worker_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          site_name?: string | null
          updated_at?: string
          user_id?: string | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_expenses_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          created_at: string
          daily_rate: number
          id: string
          is_active: boolean
          linked_user_id: string | null
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["worker_role"]
          site_name: string | null
          updated_at: string
          upi_id: string | null
          user_id: string
          worker_code: string | null
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          id?: string
          is_active?: boolean
          linked_user_id?: string | null
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["worker_role"]
          site_name?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id: string
          worker_code?: string | null
        }
        Update: {
          created_at?: string
          daily_rate?: number
          id?: string
          is_active?: boolean
          linked_user_id?: string | null
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["worker_role"]
          site_name?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id?: string
          worker_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_initial_admin: { Args: never; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_linked_worker_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_worker_account: {
        Args: { _phone: string; _worker_code: string }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "worker"
      attendance_status: "Present" | "Absent" | "Half-Day"
      brick_entry_type: "In" | "Out"
      cashbook_category: "material" | "labor" | "transport" | "other"
      cashbook_type: "income" | "expense"
      worker_role: "मिस्त्री" | "मजदूर" | "हेल्पर" | "ठेकेदार"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "worker"],
      attendance_status: ["Present", "Absent", "Half-Day"],
      brick_entry_type: ["In", "Out"],
      cashbook_category: ["material", "labor", "transport", "other"],
      cashbook_type: ["income", "expense"],
      worker_role: ["मिस्त्री", "मजदूर", "हेल्पर", "ठेकेदार"],
    },
  },
} as const
