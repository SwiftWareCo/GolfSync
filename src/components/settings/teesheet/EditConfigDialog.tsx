"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { TeesheetConfigForm } from "./TeesheetConfigForm";
import type { TeesheetConfigWithRules, Templates } from "~/server/db/schema";
import type { TeesheetConfigFormData } from "./TeesheetConfigForm";

interface TemplateBlock {
  displayName: string | null;
  startTime: string;
  maxPlayers: number;
}

interface Template extends Omit<Templates, "blocks"> {
  blocks?: TemplateBlock[];
}

interface EditConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  action: (formData: FormData) => Promise<any>;
  config: TeesheetConfigWithRules;
  templates: Template[];
  onSuccess?: () => void;
}

export function EditConfigDialog({
  isOpen,
  onClose,
  action,
  config,
  templates,
  onSuccess,
}: EditConfigDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-semibold">
            Edit Configuration
          </DialogTitle>
          <DialogDescription className="text-gray-500">
            Configure tee time settings and preview the generated time blocks
          </DialogDescription>
        </DialogHeader>

        <TeesheetConfigForm
          initialData={config}
          templates={templates}
          action={action}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}
