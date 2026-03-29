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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          project_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_definitions: {
        Row: {
          agent_type: string
          config: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          schedule: string | null
          updated_at: string
        }
        Insert: {
          agent_type: string
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          schedule?: string | null
          updated_at?: string
        }
        Update: {
          agent_type?: string
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          schedule?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          input_context: Json | null
          items_processed: number | null
          output_summary: string | null
          started_at: string
          status: string
          triggered_by: string
          triggered_by_user: string | null
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_context?: Json | null
          items_processed?: number | null
          output_summary?: string | null
          started_at?: string
          status: string
          triggered_by: string
          triggered_by_user?: string | null
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input_context?: Json | null
          items_processed?: number | null
          output_summary?: string | null
          started_at?: string
          status?: string
          triggered_by?: string
          triggered_by_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_triggered_by_user_fkey"
            columns: ["triggered_by_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interactions: {
        Row: {
          context_scope: Json
          created_at: string
          duration_ms: number | null
          id: string
          model: string
          prompt: string
          response: string | null
          surface: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          context_scope: Json
          created_at?: string
          duration_ms?: number | null
          id?: string
          model: string
          prompt: string
          response?: string | null
          surface: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          context_scope?: Json
          created_at?: string
          duration_ms?: number | null
          id?: string
          model?: string
          prompt?: string
          response?: string | null
          surface?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations: {
        Row: {
          allocation_pct: number
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          project_id: string
          role_on_project: string | null
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allocation_pct?: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          project_id: string
          role_on_project?: string | null
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allocation_pct?: number
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          project_id?: string
          role_on_project?: string | null
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_actions: {
        Row: {
          acted_at: string
          action: string
          actor_id: string
          comment: string | null
          id: string
          request_id: string
          step_order: number
        }
        Insert: {
          acted_at?: string
          action: string
          actor_id: string
          comment?: string | null
          id?: string
          request_id: string
          step_order: number
        }
        Update: {
          acted_at?: string
          action?: string
          actor_id?: string
          comment?: string | null
          id?: string
          request_id?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          completed_at: string | null
          current_step: number
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          project_id: string | null
          requested_at: string
          requested_by: string
          status: string
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          current_step?: number
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          requested_at?: string
          requested_by: string
          status: string
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          current_step?: number
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          requested_at?: string
          requested_by?: string
          status?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_steps: {
        Row: {
          approval_mode: string
          approver_type: string
          approver_value: string
          created_at: string
          id: string
          name: string
          sla_hours: number | null
          step_order: number
          workflow_id: string
        }
        Insert: {
          approval_mode: string
          approver_type: string
          approver_value: string
          created_at?: string
          id?: string
          name: string
          sla_hours?: number | null
          step_order: number
          workflow_id: string
        }
        Update: {
          approval_mode?: string
          approver_type?: string
          approver_value?: string
          created_at?: string
          id?: string
          name?: string
          sla_hours?: number | null
          step_order?: number
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "approval_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_workflows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entity_type: string
          id: string
          is_active: boolean
          name: string
          trigger_condition: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type: string
          id?: string
          is_active?: boolean
          name: string
          trigger_condition?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_type?: string
          id?: string
          is_active?: boolean
          name?: string
          trigger_condition?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_by: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_tracking: {
        Row: {
          allocated_amount: number
          category: string
          created_at: string | null
          id: string
          spent_amount: number | null
          sprint_id: string
          updated_at: string | null
        }
        Insert: {
          allocated_amount: number
          category: string
          created_at?: string | null
          id?: string
          spent_amount?: number | null
          sprint_id: string
          updated_at?: string | null
        }
        Update: {
          allocated_amount?: number
          category?: string
          created_at?: string | null
          id?: string
          spent_amount?: number | null
          sprint_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_tracking_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          impact_assessment: string | null
          sprint_id: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          impact_assessment?: string | null
          sprint_id: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          impact_assessment?: string | null
          sprint_id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      code_references: {
        Row: {
          created_at: string
          id: string
          linked_by: string | null
          metadata: Json | null
          project_id: string
          ref_author: string | null
          ref_id: string
          ref_status: string | null
          ref_title: string | null
          ref_type: string
          ref_url: string
          repo_name: string
          repo_owner: string
          updated_at: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_by?: string | null
          metadata?: Json | null
          project_id: string
          ref_author?: string | null
          ref_id: string
          ref_status?: string | null
          ref_title?: string | null
          ref_type: string
          ref_url: string
          repo_name: string
          repo_owner: string
          updated_at?: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_by?: string | null
          metadata?: Json | null
          project_id?: string
          ref_author?: string | null
          ref_id?: string
          ref_status?: string | null
          ref_title?: string | null
          ref_type?: string
          ref_url?: string
          repo_name?: string
          repo_owner?: string
          updated_at?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_references_linked_by_fkey"
            columns: ["linked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "code_references_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_mentions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_mentions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_edited: boolean
          updated_at: string
          work_item_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_edited?: boolean
          updated_at?: string
          work_item_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_edited?: boolean
          updated_at?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_requirements: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          requirement_name: string
          sprint_id: string
          status: string | null
          updated_at: string | null
          verification_method: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          requirement_name: string
          sprint_id: string
          status?: string | null
          updated_at?: string | null
          verification_method?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          requirement_name?: string
          sprint_id?: string
          status?: string | null
          updated_at?: string | null
          verification_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          context: string | null
          created_at: string
          decided: string | null
          decided_at: string | null
          decided_by: string | null
          decision_code: string | null
          due_date: string | null
          gxp_impact: string | null
          id: string
          options: Json | null
          project_id: string | null
          rationale: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          decided?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_code?: string | null
          due_date?: string | null
          gxp_impact?: string | null
          id?: string
          options?: Json | null
          project_id?: string | null
          rationale?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          decided?: string | null
          decided_at?: string | null
          decided_by?: string | null
          decision_code?: string | null
          due_date?: string | null
          gxp_impact?: string | null
          id?: string
          options?: Json | null
          project_id?: string | null
          rationale?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          sprint_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          sprint_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          sprint_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      dependencies: {
        Row: {
          created_at: string
          dependency_type: string
          id: string
          notes: string | null
          relationship: string
          source_item_id: string | null
          source_project_id: string | null
          status: string
          target_item_id: string | null
          target_project_id: string | null
        }
        Insert: {
          created_at?: string
          dependency_type: string
          id?: string
          notes?: string | null
          relationship?: string
          source_item_id?: string | null
          source_project_id?: string | null
          status?: string
          target_item_id?: string | null
          target_project_id?: string | null
        }
        Update: {
          created_at?: string
          dependency_type?: string
          id?: string
          notes?: string | null
          relationship?: string
          source_item_id?: string | null
          source_project_id?: string | null
          status?: string
          target_item_id?: string | null
          target_project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dependencies_source_item_id_fkey"
            columns: ["source_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_source_project_id_fkey"
            columns: ["source_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_target_item_id_fkey"
            columns: ["target_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dependencies_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          document_type: string | null
          external_url: string | null
          file_name: string | null
          file_size: number | null
          folder_id: string | null
          id: string
          metadata: Json | null
          mime_type: string | null
          project_id: string
          status: string
          storage_path: string | null
          tags: string[] | null
          title: string
          updated_at: string
          uploaded_by: string
          version: string | null
          work_item_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          project_id: string
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          uploaded_by: string
          version?: string | null
          work_item_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          document_type?: string | null
          external_url?: string | null
          file_name?: string | null
          file_size?: number | null
          folder_id?: string | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          project_id?: string
          status?: string
          storage_path?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          uploaded_by?: string
          version?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      encryption_config: {
        Row: {
          classification: string
          created_at: string
          description: string | null
          encrypted_columns: string[]
          id: string
          key_rotation_days: number
          updated_at: string
        }
        Insert: {
          classification: string
          created_at?: string
          description?: string | null
          encrypted_columns?: string[]
          id?: string
          key_rotation_days?: number
          updated_at?: string
        }
        Update: {
          classification?: string
          created_at?: string
          description?: string | null
          encrypted_columns?: string[]
          id?: string
          key_rotation_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      health_score_events: {
        Row: {
          health_score: number
          health_status: string
          id: string
          model_version: string
          notes: string | null
          project_id: string
          pulse_condition: string | null
          recorded_by: string | null
          risk_score: number
          signals: Json
          transaction_time: string
          trigger_source: string
          valid_time: string
        }
        Insert: {
          health_score: number
          health_status: string
          id?: string
          model_version?: string
          notes?: string | null
          project_id: string
          pulse_condition?: string | null
          recorded_by?: string | null
          risk_score: number
          signals?: Json
          transaction_time?: string
          trigger_source?: string
          valid_time?: string
        }
        Update: {
          health_score?: number
          health_status?: string
          id?: string
          model_version?: string
          notes?: string | null
          project_id?: string
          pulse_condition?: string | null
          recorded_by?: string | null
          risk_score?: number
          signals?: Json
          transaction_time?: string
          trigger_source?: string
          valid_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_score_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_score_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons_learned: {
        Row: {
          action_items: string | null
          category: string
          created_at: string | null
          description: string
          id: string
          sprint_id: string
          updated_at: string | null
        }
        Insert: {
          action_items?: string | null
          category: string
          created_at?: string | null
          description: string
          id?: string
          sprint_id: string
          updated_at?: string | null
        }
        Update: {
          action_items?: string | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          sprint_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_learned_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_feature_requests: {
        Row: {
          business_description: string
          correlation_with_target: number | null
          created_at: string | null
          feature_col_name: string | null
          feature_importance_pct: number | null
          feature_importance_rank: number | null
          first_model_version: string | null
          id: string
          leakage_flag: boolean | null
          metric_name: string
          preview_null_rate: number | null
          preview_sample_max: number | null
          preview_sample_mean: number | null
          preview_sample_min: number | null
          rejection_reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sql_expression: string | null
          status: string
          translation_notes: string | null
          updated_at: string | null
        }
        Insert: {
          business_description: string
          correlation_with_target?: number | null
          created_at?: string | null
          feature_col_name?: string | null
          feature_importance_pct?: number | null
          feature_importance_rank?: number | null
          first_model_version?: string | null
          id?: string
          leakage_flag?: boolean | null
          metric_name: string
          preview_null_rate?: number | null
          preview_sample_max?: number | null
          preview_sample_mean?: number | null
          preview_sample_min?: number | null
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sql_expression?: string | null
          status?: string
          translation_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          business_description?: string
          correlation_with_target?: number | null
          created_at?: string | null
          feature_col_name?: string | null
          feature_importance_pct?: number | null
          feature_importance_rank?: number | null
          first_model_version?: string | null
          id?: string
          leakage_flag?: boolean | null
          metric_name?: string
          preview_null_rate?: number | null
          preview_sample_max?: number | null
          preview_sample_mean?: number | null
          preview_sample_min?: number | null
          rejection_reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sql_expression?: string | null
          status?: string
          translation_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ml_feature_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_feature_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ml_model_versions: {
        Row: {
          algorithm: string
          created_at: string | null
          feature_count: number
          feature_importance: Json | null
          features_added: string[] | null
          features_removed: string[] | null
          id: string
          mae: number
          promoted_at: string | null
          promoted_by: string | null
          r_squared: number
          r_squared_std: number | null
          recommendation_reason: string | null
          retired_at: string | null
          rmse: number
          status: string
          system_recommendation: string | null
          trained_by: string | null
          training_notes: string | null
          training_rows: number
          triggered_by_request_id: string | null
          version_tag: string
        }
        Insert: {
          algorithm: string
          created_at?: string | null
          feature_count: number
          feature_importance?: Json | null
          features_added?: string[] | null
          features_removed?: string[] | null
          id?: string
          mae: number
          promoted_at?: string | null
          promoted_by?: string | null
          r_squared: number
          r_squared_std?: number | null
          recommendation_reason?: string | null
          retired_at?: string | null
          rmse: number
          status?: string
          system_recommendation?: string | null
          trained_by?: string | null
          training_notes?: string | null
          training_rows: number
          triggered_by_request_id?: string | null
          version_tag: string
        }
        Update: {
          algorithm?: string
          created_at?: string | null
          feature_count?: number
          feature_importance?: Json | null
          features_added?: string[] | null
          features_removed?: string[] | null
          id?: string
          mae?: number
          promoted_at?: string | null
          promoted_by?: string | null
          r_squared?: number
          r_squared_std?: number | null
          recommendation_reason?: string | null
          retired_at?: string | null
          rmse?: number
          status?: string
          system_recommendation?: string | null
          trained_by?: string | null
          training_notes?: string | null
          training_rows?: number
          triggered_by_request_id?: string | null
          version_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "ml_model_versions_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_model_versions_trained_by_fkey"
            columns: ["trained_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ml_model_versions_triggered_by_request_id_fkey"
            columns: ["triggered_by_request_id"]
            isOneToOne: false
            referencedRelation: "ml_feature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      model_score_history: {
        Row: {
          health_status: string
          id: string
          model_name: string
          project_id: string
          risk_score: number
          scored_at: string
          signals: Json
          weights_used: Json
        }
        Insert: {
          health_status: string
          id?: string
          model_name?: string
          project_id: string
          risk_score: number
          scored_at?: string
          signals: Json
          weights_used: Json
        }
        Update: {
          health_status?: string
          id?: string
          model_name?: string
          project_id?: string
          risk_score?: number
          scored_at?: string
          signals?: Json
          weights_used?: Json
        }
        Relationships: [
          {
            foreignKeyName: "model_score_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      model_weights: {
        Row: {
          description: string | null
          id: string
          is_active: boolean
          max_val: number | null
          min_val: number | null
          model_name: string
          signal_name: string
          updated_at: string
          weight: number
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean
          max_val?: number | null
          min_val?: number | null
          model_name?: string
          signal_name: string
          updated_at?: string
          weight?: number
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean
          max_val?: number | null
          min_val?: number | null
          model_name?: string
          signal_name?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          project_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          project_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          project_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          display_name: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          role?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          budget_total: number | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          owner_id: string | null
          start_date: string | null
          status: string
          target_end: string | null
          updated_at: string
        }
        Insert: {
          budget_total?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          target_end?: string | null
          updated_at?: string
        }
        Update: {
          budget_total?: number | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          start_date?: string | null
          status?: string
          target_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_folders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          is_template: boolean
          name: string
          parent_id: string | null
          project_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          is_template?: boolean
          name: string
          parent_id?: string | null
          project_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          is_template?: boolean
          name?: string
          parent_id?: string | null
          project_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_outcomes: {
        Row: {
          actual_budget: number | null
          actual_duration: number | null
          actual_points: number | null
          category: string | null
          completed_at: string | null
          complexity: string | null
          created_at: string
          final_health: string | null
          id: string
          lessons_learned: string | null
          on_budget: boolean | null
          on_time: boolean | null
          planned_budget: number | null
          planned_duration: number | null
          planned_points: number | null
          project_id: string | null
          risk_factors: Json | null
          scope_change_pct: number | null
          sprint_count: number | null
          team_size: number | null
        }
        Insert: {
          actual_budget?: number | null
          actual_duration?: number | null
          actual_points?: number | null
          category?: string | null
          completed_at?: string | null
          complexity?: string | null
          created_at?: string
          final_health?: string | null
          id?: string
          lessons_learned?: string | null
          on_budget?: boolean | null
          on_time?: boolean | null
          planned_budget?: number | null
          planned_duration?: number | null
          planned_points?: number | null
          project_id?: string | null
          risk_factors?: Json | null
          scope_change_pct?: number | null
          sprint_count?: number | null
          team_size?: number | null
        }
        Update: {
          actual_budget?: number | null
          actual_duration?: number | null
          actual_points?: number | null
          category?: string | null
          completed_at?: string | null
          complexity?: string | null
          created_at?: string
          final_health?: string | null
          id?: string
          lessons_learned?: string | null
          on_budget?: boolean | null
          on_time?: boolean | null
          planned_budget?: number | null
          planned_duration?: number | null
          planned_points?: number | null
          project_id?: string | null
          risk_factors?: Json | null
          scope_change_pct?: number | null
          sprint_count?: number | null
          team_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_outcomes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stakeholders: {
        Row: {
          communication_pref: string | null
          created_at: string
          external_email: string | null
          external_name: string | null
          external_org: string | null
          id: string
          influence_level: string | null
          interest_level: string | null
          is_active: boolean
          notes: string | null
          project_id: string
          stakeholder_role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          communication_pref?: string | null
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          external_org?: string | null
          id?: string
          influence_level?: string | null
          interest_level?: string | null
          is_active?: boolean
          notes?: string | null
          project_id: string
          stakeholder_role: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          communication_pref?: string | null
          created_at?: string
          external_email?: string | null
          external_name?: string | null
          external_org?: string | null
          id?: string
          influence_level?: string | null
          interest_level?: string | null
          is_active?: boolean
          notes?: string | null
          project_id?: string
          stakeholder_role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_stakeholders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stakeholders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          actual_end: string | null
          budget_spent: number | null
          budget_total: number | null
          category: string | null
          classification: string
          code: string | null
          created_at: string
          description: string | null
          embedding: string | null
          health_score: number | null
          health_status: string | null
          health_updated: string | null
          id: string
          metadata: Json | null
          name: string
          owner_id: string | null
          priority: string
          program_id: string | null
          pulse_condition: string | null
          pulse_momentum: string | null
          pulse_signals: string[] | null
          pulse_updated_at: string | null
          risk_factors: Json | null
          risk_score: number | null
          scored_at: string | null
          start_date: string | null
          status: string
          tags: string[] | null
          target_end: string | null
          updated_at: string
          vertical: string | null
        }
        Insert: {
          actual_end?: string | null
          budget_spent?: number | null
          budget_total?: number | null
          category?: string | null
          classification?: string
          code?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          health_score?: number | null
          health_status?: string | null
          health_updated?: string | null
          id?: string
          metadata?: Json | null
          name: string
          owner_id?: string | null
          priority?: string
          program_id?: string | null
          pulse_condition?: string | null
          pulse_momentum?: string | null
          pulse_signals?: string[] | null
          pulse_updated_at?: string | null
          risk_factors?: Json | null
          risk_score?: number | null
          scored_at?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          target_end?: string | null
          updated_at?: string
          vertical?: string | null
        }
        Update: {
          actual_end?: string | null
          budget_spent?: number | null
          budget_total?: number | null
          category?: string | null
          classification?: string
          code?: string | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          health_score?: number | null
          health_status?: string | null
          health_updated?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          priority?: string
          program_id?: string | null
          pulse_condition?: string | null
          pulse_momentum?: string | null
          pulse_signals?: string[] | null
          pulse_updated_at?: string | null
          risk_factors?: Json | null
          risk_score?: number | null
          scored_at?: string | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          target_end?: string | null
          updated_at?: string
          vertical?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_gates: {
        Row: {
          created_at: string | null
          criteria: string
          gate_name: string
          id: string
          sprint_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criteria: string
          gate_name: string
          id?: string
          sprint_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criteria?: string
          gate_name?: string
          id?: string
          sprint_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_gates_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          ai_generated: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          impact: number | null
          mitigation: string | null
          owner_id: string | null
          probability: number | null
          project_id: string
          raised_by: string | null
          raised_date: string | null
          resolution: string | null
          resolved_date: string | null
          risk_score: number | null
          severity: string | null
          status: string
          target_date: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          impact?: number | null
          mitigation?: string | null
          owner_id?: string | null
          probability?: number | null
          project_id: string
          raised_by?: string | null
          raised_date?: string | null
          resolution?: string | null
          resolved_date?: string | null
          risk_score?: number | null
          severity?: string | null
          status?: string
          target_date?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          impact?: number | null
          mitigation?: string | null
          owner_id?: string | null
          probability?: number | null
          project_id?: string
          raised_by?: string | null
          raised_date?: string | null
          resolution?: string | null
          resolved_date?: string | null
          risk_score?: number | null
          severity?: string | null
          status?: string
          target_date?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      sprint_metrics: {
        Row: {
          avg_allocation: number | null
          burndown: Json | null
          carried_over: number | null
          committed_pts: number | null
          completed_pts: number | null
          health_score: number | null
          id: string
          project_id: string
          recorded_at: string
          risk_score: number | null
          sprint_id: string
          team_size: number | null
          velocity: number | null
        }
        Insert: {
          avg_allocation?: number | null
          burndown?: Json | null
          carried_over?: number | null
          committed_pts?: number | null
          completed_pts?: number | null
          health_score?: number | null
          id?: string
          project_id: string
          recorded_at?: string
          risk_score?: number | null
          sprint_id: string
          team_size?: number | null
          velocity?: number | null
        }
        Update: {
          avg_allocation?: number | null
          burndown?: Json | null
          carried_over?: number | null
          committed_pts?: number | null
          completed_pts?: number | null
          health_score?: number | null
          id?: string
          project_id?: string
          recorded_at?: string
          risk_score?: number | null
          sprint_id?: string
          team_size?: number | null
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprint_metrics_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_milestones: {
        Row: {
          created_at: string | null
          id: string
          name: string
          sprint_id: string
          status: string | null
          target_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          sprint_id: string
          status?: string | null
          target_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          sprint_id?: string
          status?: string | null
          target_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sprint_milestones_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          capacity_points: number | null
          committed_pts: number | null
          completed_pts: number | null
          created_at: string
          end_date: string
          goal: string | null
          id: string
          name: string
          phase_id: string | null
          project_id: string
          retro_notes: string | null
          sprint_number: number
          start_date: string
          status: string
          updated_at: string
          velocity: number | null
        }
        Insert: {
          capacity_points?: number | null
          committed_pts?: number | null
          completed_pts?: number | null
          created_at?: string
          end_date: string
          goal?: string | null
          id?: string
          name: string
          phase_id?: string | null
          project_id: string
          retro_notes?: string | null
          sprint_number: number
          start_date: string
          status?: string
          updated_at?: string
          velocity?: number | null
        }
        Update: {
          capacity_points?: number | null
          committed_pts?: number | null
          completed_pts?: number | null
          created_at?: string
          end_date?: string
          goal?: string | null
          id?: string
          name?: string
          phase_id?: string | null
          project_id?: string
          retro_notes?: string | null
          sprint_number?: number
          start_date?: string
          status?: string
          updated_at?: string
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sprints_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sprints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_communications: {
        Row: {
          audience: string | null
          communication_type: string
          created_at: string | null
          frequency: string | null
          id: string
          sprint_id: string
          updated_at: string | null
        }
        Insert: {
          audience?: string | null
          communication_type: string
          created_at?: string | null
          frequency?: string | null
          id?: string
          sprint_id: string
          updated_at?: string | null
        }
        Update: {
          audience?: string | null
          communication_type?: string
          created_at?: string | null
          frequency?: string | null
          id?: string
          sprint_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_communications_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          date: string
          hours: number
          id: string
          notes: string | null
          user_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string
          date: string
          hours: number
          id?: string
          notes?: string | null
          user_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string
          date?: string
          hours?: number
          id?: string
          notes?: string | null
          user_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          assessment_type: string
          created_at: string
          id: string
          notes: string | null
          proficiency: number
          skill_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          assessment_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          proficiency: number
          skill_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          assessment_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          proficiency?: number
          skill_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_management: {
        Row: {
          contract_end_date: string | null
          contract_start_date: string | null
          cost: number | null
          created_at: string | null
          id: string
          service_description: string | null
          sprint_id: string
          status: string | null
          updated_at: string | null
          vendor_name: string
        }
        Insert: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          service_description?: string | null
          sprint_id: string
          status?: string | null
          updated_at?: string | null
          vendor_name: string
        }
        Update: {
          contract_end_date?: string | null
          contract_start_date?: string | null
          cost?: number | null
          created_at?: string | null
          id?: string
          service_description?: string | null
          sprint_id?: string
          status?: string | null
          updated_at?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_management_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          actual_hours: number | null
          assignee_id: string | null
          board_position: number | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          id: string
          labels: string[] | null
          metadata: Json | null
          parent_id: string | null
          phase_id: string | null
          priority: string
          project_id: string
          reporter_id: string | null
          sprint_id: string | null
          start_date: string | null
          status: string
          story_points: number | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          assignee_id?: string | null
          board_position?: number | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          labels?: string[] | null
          metadata?: Json | null
          parent_id?: string | null
          phase_id?: string | null
          priority?: string
          project_id: string
          reporter_id?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status?: string
          story_points?: number | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          assignee_id?: string | null
          board_position?: number | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          id?: string
          labels?: string[] | null
          metadata?: Json | null
          parent_id?: string | null
          phase_id?: string | null
          priority?: string
          project_id?: string
          reporter_id?: string | null
          sprint_id?: string | null
          start_date?: string | null
          status?: string
          story_points?: number | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      portfolio_summary: {
        Row: {
          active_projects: number | null
          avg_health_score: number | null
          completed_projects: number | null
          max_health_score: number | null
          min_health_score: number | null
          momentum_declining: number | null
          momentum_recovering: number | null
          momentum_stable: number | null
          momentum_volatile: number | null
          needs_attention: number | null
          on_hold_projects: number | null
          planning_projects: number | null
          pulse_critical: number | null
          pulse_dormant: number | null
          pulse_elevated: number | null
          pulse_healthy: number | null
          pulse_watch: number | null
          refreshed_at: string | null
          signal_budget_count: number | null
          signal_delivery_count: number | null
          signal_execution_count: number | null
          signal_risks_count: number | null
          signal_schedule_count: number | null
          signal_scope_count: number | null
          total_budget: number | null
          total_projects: number | null
          total_spent: number | null
        }
        Relationships: []
      }
      task_activity_stream: {
        Row: {
          author_id: string | null
          author_name: string | null
          content: Json | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_type: string | null
          id: string | null
          project_id: string | null
          stream_type: string | null
        }
        Relationships: []
      }
      vertical_summary: {
        Row: {
          at_risk_count: number | null
          avg_health_score: number | null
          dormant_count: number | null
          project_count: number | null
          refreshed_at: string | null
          total_budget: number | null
          total_spent: number | null
          vertical: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_ml_training_features: {
        Args: never
        Returns: {
          active_sprints: number
          avg_allocation_pct: number
          avg_individual_risk_score: number
          avg_sprint_completion_rate: number
          avg_velocity: number
          blocked_items: number
          budget_burn_rate: number
          budget_total: number
          category: string
          days_elapsed: number
          days_remaining: number
          health_score: number
          high_severity_risks: number
          open_risks: number
          overdue_items: number
          priority: string
          project_id: string
          sprint_count: number
          status: string
          team_size: number
          work_completion_rate: number
        }[]
      }
      log_auth_event: {
        Args: {
          p_action: string
          p_email?: string
          p_metadata?: Json
          p_user_id?: string
        }
        Returns: undefined
      }
      ml_batch_score_all_projects: { Args: never; Returns: Json }
      ml_compute_pulse: {
        Args: {
          p_current_health: number
          p_current_risk: number
          p_health_updated?: string
          p_project_id: string
          p_risk_factors: Json
        }
        Returns: Json
      }
      ml_propagate_risk: { Args: { p_project_id: string }; Returns: Json }
      ml_retrain_weights: { Args: never; Returns: Json }
      ml_score_project_risk: { Args: { p_project_id: string }; Returns: Json }
      refresh_portfolio_views: { Args: never; Returns: undefined }
      rls_can_write: { Args: never; Returns: boolean }
      rls_comment_project_id: { Args: { c_id: string }; Returns: string }
      rls_has_portfolio_access: { Args: never; Returns: boolean }
      rls_user_role: { Args: never; Returns: string }
      rls_visible_project_ids: { Args: never; Returns: string[] }
      rls_work_item_project_id: { Args: { wi_id: string }; Returns: string }
      search_projects_semantic: {
        Args: {
          query_embedding: string
          result_limit?: number
          similarity_threshold?: number
        }
        Returns: {
          code: string
          health_score: number
          id: string
          name: string
          pulse_condition: string
          similarity: number
          status: string
          vertical: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

