import { db } from "../../src/server/db/client";
import type { Principal } from "../../src/server/auth/access";
import {
  createDataItem,
  publishDataItem,
} from "../../src/server/data-items/service";
import { toDataItemEntry } from "../../src/server/data-items/queries";
import {
  dataItemFields,
  sameDataItemFields,
} from "../../src/shared/data-items";
import { modelItemFromCatalog } from "../../src/shared/model-data-items";
import {
  normalizeLegacyModelContent,
  type ModelContent,
} from "../../src/shared/models";

// Only called when explicitly initializing a new demo; existing history stays untouched.
export async function ensureDemoModelCatalog(
  actor: Principal,
  content: ModelContent,
) {
  const normalized = normalizeLegacyModelContent(content).content;
  let index = 0;
  for (const stage of normalized.stages)
    for (const category of stage.categories) {
      for (let i = 0; i < category.items.length; i++) {
        const item = category.items[i];
        const code = `DEMO_PV_ITEM_${++index}`;
        let entry = await db.dataItemVersion.findFirst({
          where: { dataItem: { code } },
          orderBy: { version: "desc" },
          include: { dataItem: { select: { code: true } } },
        });
        if (!entry)
          entry = await createDataItem(actor, {
            code,
            ...dataItemFields(item),
          });
        if (!sameDataItemFields(entry, item))
          throw new Error(`演示公共数据项编码内容冲突：${code}`);
        if (entry.status === "DRAFT")
          ({ entry } = await publishDataItem(actor, entry.id, {
            ...dataItemFields(item),
            revision: entry.revision,
          }));
        if (entry.retiredAt) throw new Error(`演示公共数据项已停用：${code}`);
        category.items[i] = modelItemFromCatalog(
          toDataItemEntry(entry),
          item.id,
        );
      }
    }
  return normalized;
}
