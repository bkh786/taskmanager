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
      app_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          date_of_joining: string | null
          designation_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          mobile_number: string | null
          org_id: string | null
          project_id: string | null
          replaced_user_id: string | null
          reports_to: string | null
          system_role: Database["public"]["Enums"]["system_role"]
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date_of_joining?: string | null
          designation_id?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean | null
          mobile_number?: string | null
          org_id?: string | null
          project_id?: string | null
          replaced_user_id?: string | null
          reports_to?: string | null
          system_role: Database["public"]["Enums"]["system_role"]
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date_of_joining?: string | null
          designation_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          mobile_number?: string | null
          org_id?: string | null
          project_id?: string | null
          replaced_user_id?: string | null
          reports_to?: string | null
          system_role?: Database["public"]["Enums"]["system_role"]
        }
        Relationships: [
          {
            foreignKeyName: "app_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_replaced_user_id_fkey"
            columns: ["replaced_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      designations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "designations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      manager_projects: {
        Row: {
          id: string
          manager_id: string | null
          project_id: string | null
        }
        Insert: {
          id?: string
          manager_id?: string | null
          project_id?: string | null
        }
        Update: {
          id?: string
          manager_id?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          notif_type: string | null
          org_id: string | null
          recipient_email: string | null
          sent_at: string | null
          status: string | null
          task_instance_id: string | null
        }
        Insert: {
          id?: string
          notif_type?: string | null
          org_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          status?: string | null
          task_instance_id?: string | null
        }
        Update: {
          id?: string
          notif_type?: string | null
          org_id?: string | null
          recipient_email?: string | null
          sent_at?: string | null
          status?: string | null
          task_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          auto_deactivate_date: string | null
          billing_status: string
          created_at: string | null
          custom_login_domain: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_users: number | null
          name: string
          plan: string
          reminder_time: string | null
          slug: string
          smtp_from_email: string | null
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_username: string | null
        }
        Insert: {
          auto_deactivate_date?: string | null
          billing_status?: string
          created_at?: string | null
          custom_login_domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name: string
          plan?: string
          reminder_time?: string | null
          slug: string
          smtp_from_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
        }
        Update: {
          auto_deactivate_date?: string | null
          billing_status?: string
          created_at?: string | null
          custom_login_domain?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_users?: number | null
          name?: string
          plan?: string
          reminder_time?: string | null
          slug?: string
          smtp_from_email?: string | null
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_username?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          id: string
          name: string
          org_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          org_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_instances: {
        Row: {
          assignee_id: string | null
          attachment_url: string | null
          comment: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          due_date: string
          id: string
          original_assignee_id: string | null
          removal_reason: string | null
          removed: boolean | null
          removed_at: string | null
          removed_by: string | null
          status: Database["public"]["Enums"]["instance_status"] | null
          task_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          attachment_url?: string | null
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          due_date: string
          id?: string
          original_assignee_id?: string | null
          removal_reason?: string | null
          removed?: boolean | null
          removed_at?: string | null
          removed_by?: string | null
          status?: Database["public"]["Enums"]["instance_status"] | null
          task_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          attachment_url?: string | null
          comment?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          due_date?: string
          id?: string
          original_assignee_id?: string | null
          removal_reason?: string | null
          removed?: boolean | null
          removed_at?: string | null
          removed_by?: string | null
          status?: Database["public"]["Enums"]["instance_status"] | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_instances_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_original_assignee_id_fkey"
            columns: ["original_assignee_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_removed_by_fkey"
            columns: ["removed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_instances_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_transfer_log: {
        Row: {
          from_user_id: string | null
          id: string
          reason: string | null
          task_instance_id: string | null
          to_user_id: string | null
          transferred_at: string | null
          transferred_by: string | null
        }
        Insert: {
          from_user_id?: string | null
          id?: string
          reason?: string | null
          task_instance_id?: string | null
          to_user_id?: string | null
          transferred_at?: string | null
          transferred_by?: string | null
        }
        Update: {
          from_user_id?: string | null
          id?: string
          reason?: string | null
          task_instance_id?: string | null
          to_user_id?: string | null
          transferred_at?: string | null
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_transfer_log_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_transfer_log_task_instance_id_fkey"
            columns: ["task_instance_id"]
            isOneToOne: false
            referencedRelation: "task_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_transfer_log_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_transfer_log_transferred_by_fkey"
            columns: ["transferred_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          org_id: string | null
          recurrence_interval: number | null
          recurrence_kind: Database["public"]["Enums"]["recurrence_kind"] | null
          reminder_enabled: boolean | null
          start_date: string
          task_name: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          org_id?: string | null
          recurrence_interval?: number | null
          recurrence_kind?:
            | Database["public"]["Enums"]["recurrence_kind"]
            | null
          reminder_enabled?: boolean | null
          start_date: string
          task_name: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          org_id?: string | null
          recurrence_interval?: number | null
          recurrence_kind?:
            | Database["public"]["Enums"]["recurrence_kind"]
            | null
          reminder_enabled?: boolean | null
          start_date?: string
          task_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_replacement_log: {
        Row: {
          id: string
          new_user_id: string | null
          old_user_id: string | null
          replaced_at: string | null
          replaced_by: string | null
        }
        Insert: {
          id?: string
          new_user_id?: string | null
          old_user_id?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
        }
        Update: {
          id?: string
          new_user_id?: string | null
          old_user_id?: string | null
          replaced_at?: string | null
          replaced_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_replacement_log_new_user_id_fkey"
            columns: ["new_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_replacement_log_old_user_id_fkey"
            columns: ["old_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_replacement_log_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      org_branding: {
        Row: {
          logo_url: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          logo_url?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          logo_url?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_app_user: {
        Args: never
        Returns: {
          created_at: string | null
          created_by: string | null
          date_of_joining: string | null
          designation_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          mobile_number: string | null
          org_id: string | null
          project_id: string | null
          replaced_user_id: string | null
          reports_to: string | null
          system_role: Database["public"]["Enums"]["system_role"]
        }
        SetofOptions: {
          from: "*"
          to: "app_users"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_task_instances: {
        Args: { p_horizon_date?: string; p_task_id: string }
        Returns: number
      }
      refresh_all_task_instances: { Args: never; Returns: undefined }
      reporting_chain: {
        Args: { p_manager_id: string }
        Returns: {
          designation_id: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          project_id: string
          system_role: Database["public"]["Enums"]["system_role"]
        }[]
      }
    }
    Enums: {
      instance_status: "pending" | "completed" | "delayed" | "removed"
      recurrence_kind: "one_time" | "daily" | "weekly" | "monthly"
      system_role:
        | "platform_owner"
        | "master_admin"
        | "reporting_manager"
        | "user"
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
      instance_status: ["pending", "completed", "delayed", "removed"],
      recurrence_kind: ["one_time", "daily", "weekly", "monthly"],
      system_role: [
        "platform_owner",
        "master_admin",
        "reporting_manager",
        "user",
      ],
    },
  },
} as const
