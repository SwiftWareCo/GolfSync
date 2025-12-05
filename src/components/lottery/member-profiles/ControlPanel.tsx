"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";
import { resetAllAdminPriorityAdjustmentsAction } from "~/server/lottery/member-profiles-actions";
import { triggerManualMaintenance } from "~/server/lottery/maintenance-actions";
import { toast } from "react-hot-toast";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart3 } from "lucide-react";

export function ControlPanel() {
  const [isResetting, setIsResetting] = useState(false);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState(false);

  const handleResetAllAdjustments = async () => {
    setIsResetting(true);
    try {
      const result = await resetAllAdminPriorityAdjustmentsAction();
      if (result.success) {
        toast.success(
          `Reset ${result.updatedCount} admin priority adjustments`,
        );
      } else {
        toast.error(result.error || "Failed to reset adjustments");
      }
    } catch (error) {
      toast.error("An error occurred while resetting adjustments");
    } finally {
      setIsResetting(false);
      setResetConfirmOpen(false);
    }
  };

  const handleRunMaintenance = async () => {
    setIsRunningMaintenance(true);
    try {
      const result = await triggerManualMaintenance();
      if (result.success) {
        toast.success("Manual maintenance completed successfully");
      } else {
        toast.error(result.error || "Failed to run maintenance");
      }
    } catch (error) {
      toast.error("An error occurred while running maintenance");
    } finally {
      setIsRunningMaintenance(false);
      setMaintenanceConfirmOpen(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Member Profiles Management
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setMaintenanceConfirmOpen(true)}
                disabled={isRunningMaintenance}
              >
                {isRunningMaintenance ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Run Maintenance
              </Button>
              <Button
                variant="outline"
                onClick={() => setResetConfirmOpen(true)}
                disabled={isResetting}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Reset Adjustments
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <ConfirmationDialog
        open={resetConfirmOpen}
        onOpenChange={() => setResetConfirmOpen(false)}
        onConfirm={handleResetAllAdjustments}
        title="Reset All Admin Priority Adjustments"
        description={`This will reset all admin priority adjustments to 0. This action cannot be undone.`}
        confirmText="Reset All"
        variant="destructive"
        loading={isResetting}
      />

      <ConfirmationDialog
        open={maintenanceConfirmOpen}
        onOpenChange={() => setMaintenanceConfirmOpen(false)}
        onConfirm={handleRunMaintenance}
        title="Run Manual Maintenance"
        description="This will reset fairness scores for the current month. Speed profiles are updated automatically when rounds are completed."
        confirmText="Run Maintenance"
        variant="default"
        loading={isRunningMaintenance}
      />
    </>
  );
}
