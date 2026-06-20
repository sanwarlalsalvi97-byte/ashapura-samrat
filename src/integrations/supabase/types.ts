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
          notes: string | null
          site_name: string | null
          status: Database["public"]["Enums"]["attendance_status"]
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
          notes?: string | null
          site_name?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
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
          notes?: string | null
          site_name?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
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
          site_name: string | null
          type: Database["public"]["Enums"]["cashbook_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: Database["public"]["Enums"]["cashbook_category"]
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          site_name?: string | null
          type: Database["public"]["Enums"]["cashbook_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["cashbook_category"]
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          site_name?: string | null
          type?: Database["public"]["Enums"]["cashbook_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      workers: {
        Row: {
          created_at: string
          daily_rate: number
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["worker_role"]
          site_name: string | null
          updated_at: string
          upi_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_rate?: number
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["worker_role"]
          site_name?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          daily_rate?: number
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["worker_role"]
          site_name?: string | null
          updated_at?: string
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_initial_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "staff"],
      attendance_status: ["Present", "Absent", "Half-Day"],
      brick_entry_type: ["In", "Out"],
      cashbook_category: ["material", "labor", "transport", "other"],
      cashbook_type: ["income", "expense"],
      worker_role: ["मिस्त्री", "मजदूर", "हेल्पर", "ठेकेदार"],
    },
  },
} as const
