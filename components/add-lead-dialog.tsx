"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import {
  LEAD_STATUSES,
  PIPELINE_STAGES,
  INDUSTRIES,
  type Lead,
  type LeadStatus,
  type PipelineStage,
} from "@/lib/types";

const leadSchema = z.object({
  company_name: z.string().min(1, "Company name is required"),
  contact_name: z.string().optional().default(""),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().optional().default(""),
  website: z.string().optional().default(""),
  industry: z.string().optional().default("Other"),
  status: z.enum(["Cold", "Warm", "Hot"]),
  pipeline_stage: z.enum([
    "New Lead",
    "Contacted",
    "Follow Up",
    "Interested",
    "Meeting Scheduled",
    "Proposal Sent",
    "Negotiation",
    "Won",
    "Lost",
  ]),
  notes: z.string().optional().default(""),
});

type LeadFormValues = z.infer<typeof leadSchema>;

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadAdded: (lead: Lead) => void;
}

export function AddLeadDialog({
  open,
  onOpenChange,
  onLeadAdded,
}: AddLeadDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      website: "",
      industry: "Other",
      status: "Cold",
      pipeline_stage: "New Lead",
      notes: "",
    },
  });

  const status = watch("status");
  const pipelineStage = watch("pipeline_stage");
  const industry = watch("industry");

  React.useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (values: LeadFormValues) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          company_name: values.company_name,
          contact_name: values.contact_name || null,
          email: values.email || null,
          phone: values.phone || null,
          website: values.website || null,
          industry: values.industry || "Other",
          status: values.status,
          pipeline_stage: values.pipeline_stage,
          notes: values.notes || null,
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (data) {
        toast.success("Lead added successfully");
        onLeadAdded(data as Lead);
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Create a new lead in your CRM. All fields except company name are
            optional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="company_name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company_name"
                placeholder="Acme Corp"
                {...register("company_name")}
              />
              {errors.company_name && (
                <p className="text-xs text-destructive">
                  {errors.company_name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                placeholder="John Smith"
                {...register("contact_name")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={industry}
                onValueChange={(v) => setValue("industry", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@acme.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                {...register("phone")}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="acme.com"
                {...register("website")}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setValue("status", v as LeadStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pipeline_stage">Pipeline Stage</Label>
              <Select
                value={pipelineStage}
                onValueChange={(v) =>
                  setValue("pipeline_stage", v as PipelineStage)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Any additional context about this lead…"
                {...register("notes")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
