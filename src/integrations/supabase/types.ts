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
      cash_receipts: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          order_id: string | null
          payment_method: string
          receipt_date: string
          receipt_number: string
          reference_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method: string
          receipt_date?: string
          receipt_number: string
          reference_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string
          receipt_date?: string
          receipt_number?: string
          reference_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_receipts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          current_balance: number | null
          description: string | null
          id: string
          is_active: boolean
          opening_balance: number | null
          parent_account_id: string | null
          updated_at: string
        }
        Insert: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          created_at?: string
          current_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          opening_balance?: number | null
          parent_account_id?: string | null
          updated_at?: string
        }
        Update: {
          account_code?: string
          account_name?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          current_balance?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          opening_balance?: number | null
          parent_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_agent_receipts_account: {
        Row: {
          account_id: string | null
          agent_id: string
          created_at: string | null
          current_balance: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          agent_id: string
          created_at?: string | null
          current_balance?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          agent_id?: string
          created_at?: string | null
          current_balance?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_agent_receipts_account_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_agent_receipts_account_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "commission_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_agents: {
        Row: {
          address: string | null
          agent_code: string
          agent_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          agent_code: string
          agent_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          agent_code?: string
          agent_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      commission_structures: {
        Row: {
          agent_id: string
          commission_rate: number
          commission_type: string
          created_at: string | null
          id: string
          item_id: string | null
        }
        Insert: {
          agent_id: string
          commission_rate: number
          commission_type: string
          created_at?: string | null
          id?: string
          item_id?: string | null
        }
        Update: {
          agent_id?: string
          commission_rate?: number
          commission_type?: string
          created_at?: string | null
          id?: string
          item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_structures_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "commission_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_structures_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_transactions: {
        Row: {
          agent_id: string
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          transaction_date: string | null
          transaction_type: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          transaction_date?: string | null
          transaction_type: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          transaction_date?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_transactions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "commission_agents"
            referencedColumns: ["id"]
          },
        ]
      }
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
          commission_agent_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          customer_name: string
          id: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          commission_agent_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name: string
          id?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          commission_agent_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_commission_agent_id_fkey"
            columns: ["commission_agent_id"]
            isOneToOne: false
            referencedRelation: "commission_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          expense_number: string
          expense_type: string
          id: string
          payment_method: string
          receipt_attached: boolean | null
          reference_number: string | null
          status: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          expense_number: string
          expense_type: string
          id?: string
          payment_method: string
          receipt_attached?: boolean | null
          reference_number?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          expense_number?: string
          expense_type?: string
          id?: string
          payment_method?: string
          receipt_attached?: boolean | null
          reference_number?: string | null
          status?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: []
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
      journal_entries: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: string
          id: string
          reference_number: string | null
          reference_type: string | null
          status: string
          total_credit: number
          total_debit: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          entry_number: string
          id?: string
          reference_number?: string | null
          reference_type?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          reference_number?: string | null
          reference_type?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
        }
        Relationships: []
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      label_configurations: {
        Row: {
          company_name: string | null
          created_at: string | null
          fields_config: Json
          id: string
          label_height_mm: number
          label_width_mm: number
          logo_url: string | null
          orientation: string
          updated_at: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          fields_config?: Json
          id?: string
          label_height_mm?: number
          label_width_mm?: number
          logo_url?: string | null
          orientation?: string
          updated_at?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          fields_config?: Json
          id?: string
          label_height_mm?: number
          label_width_mm?: number
          logo_url?: string | null
          orientation?: string
          updated_at?: string | null
        }
        Relationships: []
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
      sales_returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          item_id: string
          notes: string | null
          order_id: string | null
          quantity: number
          reason: string | null
          refund_amount: number | null
          return_date: string
          return_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          item_id: string
          notes?: string | null
          order_id?: string | null
          quantity: number
          reason?: string | null
          refund_amount?: number | null
          return_date?: string
          return_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          item_id?: string
          notes?: string | null
          order_id?: string | null
          quantity?: number
          reason?: string | null
          refund_amount?: number | null
          return_date?: string
          return_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_number: string
          purchase_id: string | null
          reference_number: string | null
          status: string
          supplier_contact: string | null
          supplier_name: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          payment_number: string
          purchase_id?: string | null
          reference_number?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_number?: string
          purchase_id?: string | null
          reference_number?: string | null
          status?: string
          supplier_contact?: string | null
          supplier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
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
      generate_expense_number: { Args: never; Returns: string }
      generate_journal_entry_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_payment_number: { Args: never; Returns: string }
      generate_purchase_number: { Args: never; Returns: string }
      generate_receipt_number: { Args: never; Returns: string }
      generate_return_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_customer_of_current_agent: {
        Args: { cust_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      app_role:
        | "admin"
        | "operator"
        | "production_manager"
        | "sales"
        | "customer"
        | "accountant"
        | "commission_agent"
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
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      app_role: [
        "admin",
        "operator",
        "production_manager",
        "sales",
        "customer",
        "accountant",
        "commission_agent",
      ],
    },
  },
} as const
