"use client";

import { useState } from "react";
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
import { Edit, Trash, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";


interface TemplateManagementProps {
  initialTemplates: Template[];
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

export function TemplateManagement({
  initialTemplates,
}: TemplateManagementProps) {
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
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

  const handleDelete = async (templateId: number) => {
    try {
      await deleteTemplate(templateId);
      const updatedTemplates = templates.filter((t) => t.id !== templateId);
      setTemplates(updatedTemplates);
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
          const updatedTemplates = [...templates, newTemplate];
          setTemplates(updatedTemplates);
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
          const updatedTemplates = templates.map((t) =>
            t.id === editingTemplate.id ? editingTemplate : t,
          );
          setTemplates(updatedTemplates);
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

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6">
      {/* Left Panel: Template List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Templates</CardTitle>
              <CardDescription>
                Manage your custom block templates
              </CardDescription>
            </div>
            <Button
              size="sm"
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
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`group relative rounded-lg border p-3 transition-colors hover:bg-gray-50 ${
                    editingTemplate?.id === template.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => handleEdit(template)}>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-gray-500">
                        {template.blocks?.length || 0} blocks
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
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
                        className="h-7 w-7"
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

              {templates.length === 0 && (
                <div className="py-8 text-center text-sm text-gray-500">
                  No templates yet. Click "New" to create one.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right Panel: Template Editor */}
      <div className="space-y-6">
        {editingTemplate ? (
          <>
            {/* Template Name */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingTemplate.id === -1 ? "Create Template" : "Edit Template"}
                </CardTitle>
                <CardDescription>
                  Configure your template name and blocks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
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
                      placeholder="e.g., Shotgun Tournament"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Add Blocks */}
            <Card>
              <CardHeader>
                <CardTitle>Add Blocks</CardTitle>
                <CardDescription>
                  Add blocks one at a time or in bulk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="single" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="single">Single Block</TabsTrigger>
                    <TabsTrigger value="bulk">Bulk Create</TabsTrigger>
                  </TabsList>

                  <TabsContent value="single" className="space-y-3 pt-4">
                    <div className="grid grid-cols-[2fr,1fr,1fr] gap-3">
                      <div>
                        <Label>Display Name</Label>
                        <Input
                          placeholder="e.g., Hole 1, Hole A"
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
                          value={newBlock.maxPlayers}
                          onChange={(e) =>
                            setNewBlock({
                              ...newBlock,
                              maxPlayers: parseInt(e.target.value) || 4,
                            })
                          }
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

                  <TabsContent value="bulk" className="space-y-3 pt-4">
                    <div className="grid grid-cols-3 gap-3">
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
                          placeholder="Hole"
                        />
                      </div>
                      <div>
                        <Label>Start Number</Label>
                        <Input
                          type="number"
                          min={1}
                          value={bulkBlock.startNumber}
                          onChange={(e) =>
                            setBulkBlock({
                              ...bulkBlock,
                              startNumber: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Count</Label>
                        <Input
                          type="number"
                          min={1}
                          value={bulkBlock.count}
                          onChange={(e) =>
                            setBulkBlock({
                              ...bulkBlock,
                              count: parseInt(e.target.value) || 1,
                            })
                          }
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
                        <Label>Interval (min)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={bulkBlock.interval}
                          onChange={(e) =>
                            setBulkBlock({
                              ...bulkBlock,
                              interval: parseInt(e.target.value) || 10,
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
                          value={bulkBlock.maxPlayers}
                          onChange={(e) =>
                            setBulkBlock({
                              ...bulkBlock,
                              maxPlayers: parseInt(e.target.value) || 4,
                            })
                          }
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
              </CardContent>
            </Card>

            {/* Blocks List */}
            <Card>
              <CardHeader>
                <CardTitle>Blocks ({editingTemplate.blocks?.length || 0})</CardTitle>
                <CardDescription>
                  Drag to reorder blocks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="blocks">
                    {(provided) => (
                      <ScrollArea className="h-[400px]">
                        <div
                          className="space-y-2 pr-4"
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
                                  className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm transition-colors hover:bg-gray-50"
                                >
                                  <div>
                                    <div className="font-medium">
                                      {block.displayName || "Unnamed Block"}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      {formatTimeStringTo12Hour(block.startTime)}{" "}
                                      - {block.maxPlayers} players
                                    </div>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="h-8 w-8"
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
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}

                          {(!editingTemplate.blocks ||
                            editingTemplate.blocks.length === 0) && (
                            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
                              <p className="text-sm text-gray-500">
                                No blocks added yet. Add blocks using the forms
                                above.
                              </p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    )}
                  </Droppable>
                </DragDropContext>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setEditingTemplate(null)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate}>
                {editingTemplate.id === -1 ? "Create Template" : "Save Changes"}
              </Button>
            </div>
          </>
        ) : (
          <Card className="h-[400px]">
            <CardContent className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 mb-4">
                  Select a template to edit or create a new one
                </p>
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
                  <Plus className="mr-2 h-5 w-5" />
                  Create New Template
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
