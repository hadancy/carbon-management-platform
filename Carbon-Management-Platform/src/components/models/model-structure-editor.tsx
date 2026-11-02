"use client";

import { useState } from "react";
import {
  Button,
  App,
  Card,
  Empty,
  Form,
  Input,
  Popconfirm,
  Space,
  Typography,
} from "antd";
import type { FormInstance } from "antd";
import { createUuid } from "@/lib/uuid";
import type { ModelContent } from "@/shared/models";
import type { DataItemEntry } from "@/shared/data-items";
import { selectModelDataItems } from "@/shared/model-data-items";
import { ModelItemTable } from "./model-item-table";
import { DataItemPicker } from "./data-item-picker";

type Selection = {
  stageIndex: number;
  categoryIndex: number;
  itemIndex: number | null;
};

export function ModelStructureEditor({
  form,
  content,
  onChange,
  readOnly,
}: {
  form: FormInstance;
  content: ModelContent;
  onChange: (content: ModelContent) => void;
  readOnly: boolean;
}) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const { message } = App.useApp();
  const selectedItems = selection
    ? (content.stages[selection.stageIndex]?.categories[selection.categoryIndex]
        ?.items ?? [])
    : [];

  function selectItems(entries: DataItemEntry[]) {
    if (!selection) return;
    try {
      change((draft) => {
        const category =
          draft.stages[selection.stageIndex]?.categories[
            selection.categoryIndex
          ];
        if (!category) throw new Error("模型结构已变化，请重新选择");
        category.items = selectModelDataItems(
          category.items,
          entries,
          createUuid,
          selection.itemIndex === null
            ? undefined
            : category.items[selection.itemIndex]?.id,
        );
      });
      setSelection(null);
    } catch (cause) {
      void message.error(cause instanceof Error ? cause.message : "添加失败");
    }
  }

  function change(mutator: (draft: ModelContent) => void) {
    const draft = structuredClone(content);
    mutator(draft);
    onChange(draft);
  }

  function move<T>(items: T[], from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
  }

  return (
    <Form form={form} className="space-y-4">
      <div className="flex items-center justify-between">
        <Typography.Title level={5} className="m-0">
          生命周期阶段与数据项
        </Typography.Title>
        {!readOnly && (
          <Button
            onClick={() =>
              change((draft) =>
                draft.stages.push({
                  id: createUuid(),
                  name: "",
                  categories: [],
                }),
              )
            }
          >
            新增阶段
          </Button>
        )}
      </div>
      {!content.stages.length && <Empty description="暂无阶段；请先新增阶段" />}
      {content.stages.map((stage, stageIndex) => (
        <Card
          key={stage.id}
          size="small"
          title={
            readOnly ? (
              stage.name
            ) : (
              <Form.Item
                name={["stage", stage.id]}
                initialValue={stage.name}
                preserve={false}
                className="mb-0 max-w-80"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "请输入阶段名称",
                  },
                ]}
              >
                <Input
                  aria-label={`第 ${stageIndex + 1} 个阶段名称`}
                  placeholder="阶段名称"
                  maxLength={120}
                  onChange={(event) =>
                    change((draft) => {
                      draft.stages[stageIndex].name = event.target.value;
                    })
                  }
                />
              </Form.Item>
            )
          }
          extra={
            !readOnly && (
              <Space size={4}>
                <Button
                  size="small"
                  disabled={stageIndex === 0}
                  onClick={() =>
                    change((draft) =>
                      move(draft.stages, stageIndex, stageIndex - 1),
                    )
                  }
                >
                  上移
                </Button>
                <Button
                  size="small"
                  disabled={stageIndex === content.stages.length - 1}
                  onClick={() =>
                    change((draft) =>
                      move(draft.stages, stageIndex, stageIndex + 1),
                    )
                  }
                >
                  下移
                </Button>
                <Popconfirm
                  title="删除该阶段及其全部数据？"
                  onConfirm={() =>
                    change((draft) => {
                      draft.stages.splice(stageIndex, 1);
                    })
                  }
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            )
          }
        >
          <div className="space-y-3">
            {stage.categories.map((category, categoryIndex) => (
              <Card
                key={category.id}
                size="small"
                type="inner"
                title={
                  readOnly ? (
                    category.name
                  ) : (
                    <Form.Item
                      name={["category", category.id]}
                      initialValue={category.name}
                      preserve={false}
                      className="mb-0 max-w-80"
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          message: "请输入大类名称",
                        },
                      ]}
                    >
                      <Input
                        aria-label={`第 ${stageIndex + 1} 阶段第 ${categoryIndex + 1} 个大类名称`}
                        placeholder="大类名称"
                        maxLength={120}
                        onChange={(event) =>
                          change((draft) => {
                            draft.stages[stageIndex].categories[
                              categoryIndex
                            ].name = event.target.value;
                          })
                        }
                      />
                    </Form.Item>
                  )
                }
                extra={
                  !readOnly && (
                    <Space size={4}>
                      <Button
                        size="small"
                        onClick={() =>
                          setSelection({
                            stageIndex,
                            categoryIndex,
                            itemIndex: null,
                          })
                        }
                      >
                        从公共库选择
                      </Button>
                      <Button
                        size="small"
                        disabled={categoryIndex === 0}
                        onClick={() =>
                          change((draft) =>
                            move(
                              draft.stages[stageIndex].categories,
                              categoryIndex,
                              categoryIndex - 1,
                            ),
                          )
                        }
                      >
                        上移
                      </Button>
                      <Button
                        size="small"
                        disabled={categoryIndex === stage.categories.length - 1}
                        onClick={() =>
                          change((draft) =>
                            move(
                              draft.stages[stageIndex].categories,
                              categoryIndex,
                              categoryIndex + 1,
                            ),
                          )
                        }
                      >
                        下移
                      </Button>
                      <Popconfirm
                        title="删除该大类及其全部数据项？"
                        onConfirm={() =>
                          change((draft) => {
                            draft.stages[stageIndex].categories.splice(
                              categoryIndex,
                              1,
                            );
                          })
                        }
                      >
                        <Button size="small" danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  )
                }
              >
                <ModelItemTable
                  items={category.items}
                  readOnly={readOnly}
                  onReplace={(itemIndex) =>
                    setSelection({ stageIndex, categoryIndex, itemIndex })
                  }
                  onMove={(itemIndex, direction) =>
                    change((draft) =>
                      move(
                        draft.stages[stageIndex].categories[categoryIndex]
                          .items,
                        itemIndex,
                        itemIndex + direction,
                      ),
                    )
                  }
                  onDelete={(itemIndex) =>
                    change((draft) => {
                      draft.stages[stageIndex].categories[
                        categoryIndex
                      ].items.splice(itemIndex, 1);
                    })
                  }
                />
              </Card>
            ))}
            {!readOnly && (
              <Button
                block
                type="dashed"
                onClick={() =>
                  change((draft) =>
                    draft.stages[stageIndex].categories.push({
                      id: createUuid(),
                      name: "",
                      items: [],
                    }),
                  )
                }
              >
                新增大类
              </Button>
            )}
          </div>
        </Card>
      ))}
      {selection && (
        <DataItemPicker
          replacing={selection.itemIndex !== null}
          excludedIds={selectedItems
            .filter((_, index) => index !== selection.itemIndex)
            .flatMap((item) =>
              item.librarySource ? [item.librarySource.dataItemId] : [],
            )}
          limit={selection.itemIndex === null ? 300 - selectedItems.length : 1}
          onCancel={() => setSelection(null)}
          onConfirm={selectItems}
        />
      )}
    </Form>
  );
}
