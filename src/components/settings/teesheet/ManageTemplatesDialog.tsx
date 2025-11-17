"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Template, TemplateBlock } from "~/app/types/TeeSheetTypes";
import { ScrollArea } from "~/components/ui/scroll-area";
import { formatTimeStringTo12Hour } from "~/lib/utils";
import { ConfigTypes } from "~/app/types/TeeSheetTypes";
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "~/server/settings/template-actions";
import { toast } from "react-hot-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Edit, Trash } from "lucide-react";

interface ManageTemplatesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  onSave: (templates: Template[]) => void;
  selectedTemplateId?: number;
  onTemplateSelect?: (templateId: number) => void;
}

interface NewBlockForm {
  displayName: string | null;
  startTime: string;
  maxPlayers: number;
}

interface BulkBlockForm {
  prefix: string;
  startNumber: number;
  count: number;
  startTime: string;
  interval: number;
  maxPlayers: number;
}

export function ManageTemplatesDialog({
  isOpen,
  onClose,
  templates,
  onSave,
  selectedTemplateId,
  onTemplateSelect,
}: ManageTemplatesDialogProps) {
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [localTemplates, setLocalTemplates] = useState<Template[]>(templates);
  const [newBlock, setNewBlock] = useState<NewBlockForm>({
    displayName: null,
    startTime: "07:00",
    maxPlayers: 4,
  });
  const [bulkBlock, setBulkBlock] = useState<BulkBlockForm>({
    prefix: "Hole",
    startNumber: 1,
    count: 9,
    startTime: "07:00",
    interval: 10,
    maxPlayers: 4,
  });

  const handleSave = async () => {
    try {
      onSave(localTemplates);
      onClose();
      toast.success("Templates saved successfully");
    } catch (error) {
      toast.error("Failed to save templates");
    }
  };

  const handleDelete = async (templateId: number) => {
    try {
      await deleteTemplate(templateId);
      const updatedTemplates = localTemplates.filter(
        (t) => t.id !== templateId,
      );
      setLocalTemplates(updatedTemplates);
      onSave(updatedTemplates);
      toast.success("Template deleted successfully");
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
  };

  const handleAddBlock = () => {
    if (!editingTemplate) return;

    const newTemplateBlock: TemplateBlock = {
      displayName: newBlock.displayName || null,
      startTime: newBlock.startTime,
      maxPlayers: newBlock.maxPlayers,
    };

    setEditingTemplate({
      ...editingTemplate,
      blocks: [...(editingTemplate.blocks || []), newTemplateBlock],
    });

    // Reset form
    setNewBlock({
      displayName: null,
      startTime: "07:00",
      maxPlayers: 4,
    });
  };

  const handleAddBulkBlocks = () => {
    if (!editingTemplate) return;

    const newBlocks: TemplateBlock[] = [];
    let currentTime = new Date(`2000-01-01T${bulkBlock.startTime}`);

    for (let i = 0; i < bulkBlock.count; i++) {
      const blockTime = currentTime.toTimeString().slice(0, 5);
      const displayName =
        bulkBlock.prefix && bulkBlock.prefix.trim()
          ? `${bulkBlock.prefix} ${bulkBlock.startNumber + i}`
          : null;

      newBlocks.push({
        displayName,
        startTime: blockTime,
        maxPlayers: bulkBlock.maxPlayers,
      });
      currentTime = new Date(
        currentTime.getTime() + bulkBlock.interval * 60000,
      );
    }

    setEditingTemplate({
      ...editingTemplate,
      blocks: [...(editingTemplate.blocks || []), ...newBlocks],
    });
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const templateData = {
        name: editingTemplate.name,
        type: ConfigTypes.CUSTOM,
        blocks: editingTemplate.blocks || [],
      };

      if (!editingTemplate.id || editingTemplate.id === -1) {
        // New template
        const result = await createTemplate(
          templateData.name,
          templateData.type,
          { blocks: templateData.blocks },
        );
        if (result.success && result.id) {
          const newTemplate: Template = {
            id: result.id,
            name: templateData.name,
            type: templateData.type,
            blocks: templateData.blocks,
          };
          const updatedTemplates = [...localTemplates, newTemplate];
          setLocalTemplates(updatedTemplates);
          onSave(updatedTemplates);
          toast.success("Template created successfully");
        } else {
          throw new Error("Failed to create template");
        }
      } else {
        // Existing template
        const result = await updateTemplate(
          editingTemplate.id,
          templateData.name,
          templateData.type,
          { blocks: templateData.blocks },
        );
        if (result.success) {
          const updatedTemplates = localTemplates.map((t) =>
            t.id === editingTemplate.id ? editingTemplate : t,
          );
          setLocalTemplates(updatedTemplates);
          onSave(updatedTemplates);
          toast.success("Template updated successfully");
        } else {
          throw new Error("Failed to update template");
        }
      }
      setEditingTemplate(null);
    } catch (error) {
      console.error("Template save error:", error);
      toast.error("Failed to save template");
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || !editingTemplate?.blocks) return;

    const blocks = Array.from(editingTemplate.blocks);
    const [reorderedBlock] = blocks.splice(result.source.index, 1);
    if (reorderedBlock) {
      blocks.splice(result.destination.index, 0, reorderedBlock);

      setEditingTemplate({
        ...editingTemplate,
        blocks,
      });
    }
  };

  const handleMaxPlayersChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === "" ? "" : parseInt(e.target.value);
    setNewBlock({
      ...newBlock,
      maxPlayers: typeof value === "number" ? value : 4,
    });
  };

  const handleBulkMaxPlayersChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value === "" ? "" : parseInt(e.target.value);
    setBulkBlock({
      ...bulkBlock,
      maxPlayers: typeof value === "number" ? value : 4,
    });
  };

  const handleStartNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === "" ? "" : parseInt(e.target.value);
    setBulkBlock({
      ...bulkBlock,
      startNumber: typeof value === "number" ? value : 1,
    });
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === "" ? "" : parseInt(e.target.value);
    setBulkBlock({
      ...bulkBlock,
      count: typeof value === "number" ? value : 1,
    });
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === "" ? "" : parseInt(e.target.value);
    setBulkBlock({
      ...bulkBlock,
      interval: typeof value === "number" ? value : 10,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex h-[90vh] max-w-6xl flex-col">
        <DialogHeader>
          <DialogTitle>Manage Templates</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* First Row - Two Columns */}
          <div className="flex h-1/2 min-h-0 gap-4">
            {/* Left Column - Templates List */}
            <div className="flex min-h-0 w-[250px] flex-col">
              <h3 className="mb-2 text-sm font-medium">Templates</h3>
              <ScrollArea className="flex-1 rounded-md border">
                <div className="space-y-1 p-2">
                  {localTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`group relative rounded-lg border p-1.5 transition-colors hover:bg-gray-50 ${
                        selectedTemplateId === template.id
                          ? "border-org-primary bg-org-primary/5"
                          : "border-gray-200"
                      }`}
                      onClick={() => onTemplateSelect?.(template.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">
                            {template.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {template.blocks?.length || 0} blocks
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(template);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(template.id);
                            }}
                          >
                            <Trash className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {localTemplates.length === 0 && (
                    <div className="py-4 text-center text-sm text-gray-500">
                      No templates yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Column - Creation/Edit Form */}
            <div className="flex min-h-0 flex-1 flex-col">
              {editingTemplate ? (
                <>
                  <h3 className="mb-4 text-sm font-medium">Edit Template</h3>
                  <div className="space-y-4 overflow-auto p-2 pt-0">
                    <div>
                      <Label>Template Name</Label>
                      <Input
                        value={editingTemplate.name}
                        onChange={(e) =>
                          setEditingTemplate({
                            ...editingTemplate,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>

                    <Tabs defaultValue="single" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="single">Single Block</TabsTrigger>
                        <TabsTrigger value="bulk">Bulk Create</TabsTrigger>
                      </TabsList>

                      <TabsContent value="single" className="space-y-2 pt-2">
                        <div className="grid grid-cols-[2fr,1fr,1fr] gap-2">
                          <div>
                            <Label>Display Name</Label>
                            <Input
                              placeholder="e.g., Hole 1, Hole A, etc."
                              value={newBlock.displayName || ""}
                              onChange={(e) =>
                                setNewBlock({
                                  ...newBlock,
                                  displayName: e.target.value || null,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Start Time</Label>
                            <Input
                              type="time"
                              value={newBlock.startTime}
                              onChange={(e) =>
                                setNewBlock({
                                  ...newBlock,
                                  startTime: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Max Players</Label>
                            <Input
                              type="number"
                              min={1}
                              max={8}
                              value={newBlock.maxPlayers || ""}
                              onChange={handleMaxPlayersChange}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          onClick={handleAddBlock}
                          disabled={!newBlock.startTime}
                        >
                          Add Block
                        </Button>
                      </TabsContent>

                      <TabsContent value="bulk" className="space-y-2 pt-2">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label>Prefix</Label>
                            <Input
                              value={bulkBlock.prefix}
                              onChange={(e) =>
                                setBulkBlock({
                                  ...bulkBlock,
                                  prefix: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Start Number</Label>
                            <Input
                              type="number"
                              min={1}
                              value={bulkBlock.startNumber || ""}
                              onChange={handleStartNumberChange}
                            />
                          </div>
                          <div>
                            <Label>Number of Blocks</Label>
                            <Input
                              type="number"
                              min={1}
                              value={bulkBlock.count || ""}
                              onChange={handleCountChange}
                            />
                          </div>
                          <div>
                            <Label>Start Time</Label>
                            <Input
                              type="time"
                              value={bulkBlock.startTime}
                              onChange={(e) =>
                                setBulkBlock({
                                  ...bulkBlock,
                                  startTime: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Interval (minutes)</Label>
                            <Input
                              type="number"
                              min={1}
                              value={bulkBlock.interval || ""}
                              onChange={handleIntervalChange}
                            />
                          </div>
                          <div>
                            <Label>Max Players</Label>
                            <Input
                              type="number"
                              min={1}
                              max={8}
                              value={bulkBlock.maxPlayers || ""}
                              onChange={handleBulkMaxPlayersChange}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          onClick={handleAddBulkBlocks}
                        >
                          Create Blocks
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col">
                  <h3 className="text-sm font-medium">Create Template</h3>
                  <div className="flex flex-grow items-center justify-center">
                    <Button
                      size="lg"
                      onClick={() => {
                        const newTemplate: Template = {
                          id: -1,
                          name: "New Template",
                          blocks: [],
                          type: ConfigTypes.CUSTOM,
                        };
                        handleEdit(newTemplate);
                      }}
                    >
                      Create New Template
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Second Row - Blocks Section */}
          {editingTemplate && (
            <div className="flex h-1/2 min-h-0 flex-col">
              <Label className="mb-2">Blocks</Label>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="blocks">
                  {(provided) => (
                    <ScrollArea className="flex-1 rounded-md border">
                      <div
                        className="space-y-1 p-2"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {editingTemplate.blocks?.map((block, index) => (
                          <Draggable
                            key={`${block.displayName}-${index}`}
                            draggableId={`${block.displayName}-${index}`}
                            index={index}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center justify-between rounded-lg border bg-white p-2 shadow-sm transition-colors hover:bg-gray-50"
                              >
                                <div>
                                  <div className="font-medium">
                                    {block.displayName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {formatTimeStringTo12Hour(block.startTime)}{" "}
                                    - {block.maxPlayers} players
                                  </div>
                                </div>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    const newBlocks = [
                                      ...(editingTemplate.blocks || []),
                                    ];
                                    newBlocks.splice(index, 1);
                                    setEditingTemplate({
                                      ...editingTemplate,
                                      blocks: newBlocks,
                                    });
                                  }}
                                >
                                  <Trash className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {(!editingTemplate.blocks ||
                          editingTemplate.blocks.length === 0) && (
                          <div className="flex h-[200px] items-center justify-center text-sm text-gray-500">
                            No blocks added yet. Add blocks using the forms
                            above.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          {editingTemplate && (
            <>
              <Button
                variant="outline"
                onClick={() => setEditingTemplate(null)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>Save Template</Button>
            </>
          )}
          {!editingTemplate && <Button onClick={onClose}>Close</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
