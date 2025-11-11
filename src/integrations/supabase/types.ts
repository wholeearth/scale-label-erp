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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customer_products: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          item_id: string
          price: number
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          item_id: string
          price: number
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          item_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          customer_name: string
          id: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name: string
          id?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          production_record_id: string | null
          quantity: number
          reference_id: string | null
          transaction_type: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          production_record_id?: string | null
          quantity?: number
          reference_id?: string | null
          transaction_type: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          production_record_id?: string | null
          quantity?: number
          reference_id?: string | null
          transaction_type?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_production_record_id_fkey"
            columns: ["production_record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["id"]
          },
        ]
      }
      item_counters: {
        Row: {
          id: string
          item_id: string
          item_serial: number
        }
        Insert: {
          id?: string
          item_id: string
          item_serial?: number
        }
        Update: {
          id?: string
          item_id?: string
          item_serial?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_counters_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          color: string | null
          created_at: string | null
          expected_weight_kg: number | null
          id: string
          item_type: string
          length_yards: number | null
          predefined_weight_kg: number | null
          product_code: string
          product_name: string
          unit_id: string | null
          updated_at: string | null
          use_predefined_weight: boolean | null
          weight_tolerance_percentage: number | null
          width_inches: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          expected_weight_kg?: number | null
          id?: string
          item_type: string
          length_yards?: number | null
          predefined_weight_kg?: number | null
          product_code: string
          product_name: string
          unit_id?: string | null
          updated_at?: string | null
          use_predefined_weight?: boolean | null
          weight_tolerance_percentage?: number | null
          width_inches?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          expected_weight_kg?: number | null
          id?: string
          item_type?: string
          length_yards?: number | null
          predefined_weight_kg?: number | null
          product_code?: string
          product_name?: string
          unit_id?: string | null
          updated_at?: string | null
          use_predefined_weight?: boolean | null
          weight_tolerance_percentage?: number | null
          width_inches?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "items_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          created_at: string | null
          id: string
          machine_code: string
          machine_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          machine_code: string
          machine_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          machine_code?: string
          machine_name?: string
        }
        Relationships: []
      }
      operator_assignments: {
        Row: {
          assigned_at: string | null
          completed_at: string | null
          id: string
          item_id: string
          operator_id: string
          quantity_assigned: number
          quantity_produced: number | null
          status: string
        }
        Insert: {
          assigned_at?: string | null
          completed_at?: string | null
          id?: string
          item_id: string
          operator_id: string
          quantity_assigned: number
          quantity_produced?: number | null
          status?: string
        }
        Update: {
          assigned_at?: string | null
          completed_at?: string | null
          id?: string
          item_id?: string
          operator_id?: string
          quantity_assigned?: number
          quantity_produced?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_assignments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_assignments_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          order_id: string
          produced_quantity: number | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          order_id: string
          produced_quantity?: number | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          order_id?: string
          produced_quantity?: number | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          order_number: string
          status: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          order_number: string
          status?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          order_number?: string
          status?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_counters: {
        Row: {
          global_serial: number
          id: string
          last_updated: string | null
        }
        Insert: {
          global_serial?: number
          id?: string
          last_updated?: string | null
        }
        Update: {
          global_serial?: number
          id?: string
          last_updated?: string | null
        }
        Relationships: []
      }
      production_records: {
        Row: {
          barcode_data: string
          created_at: string | null
          global_serial: number
          id: string
          item_id: string
          item_serial: number
          machine_id: string | null
          operator_id: string
          operator_sequence: number
          production_date: string
          production_time: string
          serial_number: string
          weight_kg: number
        }
        Insert: {
          barcode_data: string
          created_at?: string | null
          global_serial: number
          id?: string
          item_id: string
          item_serial: number
          machine_id?: string | null
          operator_id: string
          operator_sequence: number
          production_date: string
          production_time: string
          serial_number: string
          weight_kg: number
        }
        Update: {
          barcode_data?: string
          created_at?: string | null
          global_serial?: number
          id?: string
          item_id?: string
          item_serial?: number
          machine_id?: string | null
          operator_id?: string
          operator_sequence?: number
          production_date?: string
          production_time?: string
          serial_number?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_records_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_records_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          employee_code: string | null
          full_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_code?: string | null
          full_name: string
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_code?: string | null
          full_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          purchase_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          purchase_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          purchase_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          purchase_date: string
          purchase_number: string
          status: string
          supplier_address: string | null
          supplier_contact: string | null
          supplier_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          purchase_number: string
          status?: string
          supplier_address?: string | null
          supplier_contact?: string | null
          supplier_name: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_date?: string
          purchase_number?: string
          status?: string
          supplier_address?: string | null
          supplier_contact?: string | null
          supplier_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      raw_material_usage: {
        Row: {
          created_at: string | null
          id: string
          item_id: string
          operator_id: string
          quantity: number
          shift_end: string
          usage_date: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id: string
          operator_id: string
          quantity: number
          shift_end: string
          usage_date: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string
          operator_id?: string
          quantity?: number
          shift_end?: string
          usage_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_material_usage_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scale_config: {
        Row: {
          id: string
          ip_address: string
          port: number
          updated_at: string | null
        }
        Insert: {
          id?: string
          ip_address: string
          port: number
          updated_at?: string | null
        }
        Update: {
          id?: string
          ip_address?: string
          port?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      units: {
        Row: {
          abbreviation: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_purchase_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "operator"
        | "production_manager"
        | "sales"
        | "customer"
        | "accountant"
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
      app_role: [
        "admin",
        "operator",
        "production_manager",
        "sales",
        "customer",
        "accountant",
      ],
    },
  },
} as const
