import { Building2, ChevronRight } from "lucide-react";
import { filterRecordsBySearch } from "./services/dashboardService";
import { getBlockDisplayName, sortBlocks } from "./blockHierarchyUtils";
const numberFormat = new Intl.NumberFormat();

function PanchayatItem({ record, onEdit }) {
  return (
    <li className="hierarchy-panchayat">
      <span className="hierarchy-panchayat-name">
        <Building2 size={14} />
        <strong>{record.name}</strong>
      </span>
      {onEdit && (
        <button
          className="hierarchy-panchayat-edit"
          type="button"
          aria-label={`Edit ${record.name}`}
          onClick={() => onEdit(record)}
        >
          Edit
        </button>
      )}
      {(Number.isFinite(record.booth_count) || Number.isFinite(record.voter_count)) && (
        <span className="hierarchy-panchayat-counts">
          {Number.isFinite(record.booth_count) && (
            <span>{numberFormat.format(record.booth_count)} booths</span>
          )}
          {Number.isFinite(record.voter_count) && (
            <span>{numberFormat.format(record.voter_count)} voters</span>
          )}
        </span>
      )}
    </li>
  );
}

function BlockSection({
  block,
  parent,
  panchayats,
  matchingPanchayats,
  searchActive,
  showAllPanchayats,
  onEditPanchayat,
}) {
  const visiblePanchayats = showAllPanchayats ? panchayats : matchingPanchayats;

  return (
    <section className="hierarchy-block">
      <h3><ChevronRight size={15} />{getBlockDisplayName(block, parent).toUpperCase()}</h3>
      {visiblePanchayats.length ? (
        <ul className="hierarchy-panchayat-list">
          {visiblePanchayats.map((record) => (
            <PanchayatItem key={record.id} record={record} onEdit={onEditPanchayat} />
          ))}
        </ul>
      ) : (
        <p className="hierarchy-empty">
          {searchActive ? "No matching Panchayats in this Block." : "No Panchayats assigned to this Block yet."}
        </p>
      )}
    </section>
  );
}

export default function BlockHierarchy({
  blocks = [],
  panchayats = [],
  search = "",
  onClearSearch,
  onEditPanchayat,
  className = "",
}) {
  const normalizedSearch = search.trim();
  const matchingBlocks = filterRecordsBySearch(blocks, normalizedSearch, ["name"]);
  const matchingPanchayats = filterRecordsBySearch(
    panchayats,
    normalizedSearch,
    ["name", "block_name", "parent_block_name", "booth_count", "voter_count"],
  );
  const matchingBlockIds = new Set(matchingBlocks.map(({ id }) => id));
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const panchayatsByBlock = new Map();
  const matchingPanchayatsByBlock = new Map();
  for (const panchayat of panchayats) {
    if (panchayat.block_id == null) continue;
    const records = panchayatsByBlock.get(panchayat.block_id) ?? [];
    records.push(panchayat);
    panchayatsByBlock.set(panchayat.block_id, records);
  }
  for (const panchayat of matchingPanchayats) {
    if (panchayat.block_id == null) continue;
    const records = matchingPanchayatsByBlock.get(panchayat.block_id) ?? [];
    records.push(panchayat);
    matchingPanchayatsByBlock.set(panchayat.block_id, records);
  }
  const visibleBlocks = sortBlocks(
    blocks
      .filter((block) => block.parent_id != null)
      .filter((block) => {
        const parent = blocksById.get(block.parent_id);
        return !normalizedSearch
          || matchingBlockIds.has(block.id)
          || matchingBlockIds.has(parent?.id)
          || (matchingPanchayatsByBlock.get(block.id)?.length ?? 0) > 0;
      }),
    blocksById,
  );

  return (
    <div className={`block-hierarchy ${className}`.trim()}>
      {visibleBlocks.length ? (
        <div className="hierarchy-block-list">
          {visibleBlocks.map((block) => {
            const parent = blocksById.get(block.parent_id);
            return (
              <BlockSection
                key={block.id}
                block={block}
                parent={parent}
                panchayats={panchayatsByBlock.get(block.id) ?? []}
                matchingPanchayats={matchingPanchayatsByBlock.get(block.id) ?? []}
                searchActive={Boolean(normalizedSearch)}
                showAllPanchayats={
                  !normalizedSearch
                  || matchingBlockIds.has(parent?.id)
                  || matchingBlockIds.has(block.id)
                }
                onEditPanchayat={onEditPanchayat}
              />
            );
          })}
        </div>
      ) : (
        <div className="workspace-empty">
          <strong>{normalizedSearch ? "No matching hierarchy records" : "Block hierarchy unavailable"}</strong>
          <p>{normalizedSearch
            ? "Try a different search term."
            : "The live Block hierarchy has not been returned by the API. No Block assignments are inferred."}</p>
        </div>
      )}

      {normalizedSearch && onClearSearch && (
        <div className="table-footer">
          <button type="button" onClick={onClearSearch}>Clear search <ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
