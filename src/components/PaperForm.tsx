"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { createPaper } from "@/lib/papers";

const paperFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  type: z.string().min(1, {
    message: "Type is required.",
  }),
  gsm: z.number().int().positive({
    message: "GSM must be a positive number.",
  }),
  bf: z.number().positive({
    message: "BF must be a positive number.",
  }),
  shade: z.string().min(1, {
    message: "Shade is required.",
  }),
});

type PaperFormValues = z.infer<typeof paperFormSchema>;

interface PaperFormProps {
  onSuccess?: () => void;
  children?: React.ReactNode;
}

export function PaperForm({ onSuccess, children }: PaperFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<PaperFormValues>({
    resolver: zodResolver(paperFormSchema),
    defaultValues: {
      name: "",
      type: "standard",
      gsm: 1,
      bf: 1,
      shade: "",
    },
  });

  const onSubmit = async (values: PaperFormValues) => {
    try {
      setLoading(true);
      await createPaper(values);
      alert("Paper type created successfully!");
      setOpen(false);
      form.reset();
      onSuccess?.();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create paper type.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Paper Type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Paper Type</DialogTitle>
          <DialogDescription>
            Add a new paper type to your inventory. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Glossy A4" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., standard, glossy, matte" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gsm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSM</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="e.g., 90" 
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>BF</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="e.g., 18.5" 
                        {...field}
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="shade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shade</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., white, cream, ivory" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
