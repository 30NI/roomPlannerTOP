"use client";

import { Stage, Layer, Rect, Line, Text, Group, Circle } from "react-konva";
import { useEffect, useMemo, useRef, useState } from "react";

type RoomKey = "kinsmen" | "accursi";
type TableType = "rect" | "round" | "highTop" | "square";
type DividerMode = "full" | "top" | "bottom";
type SeatLayout = "none" | "oneSide" | "even";

type Bounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type TableItem = {
  id: number;
  type: TableType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  showAttachedChairs: boolean;
  seatCount: number;
  seatLayout: SeatLayout;
};

type ChairItem = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

type ChairRowItem = {
  id: number;
  x: number;
  y: number;
  chairCount: number;
  chairWidth: number;
  chairHeight: number;
  spacing: number;
  rotation: number;
};

type ChairBlockItem = {
  id: number;
  x: number;
  y: number;
  rows: number;
  cols: number;
  chairWidth: number;
  chairHeight: number;
  colSpacing: number;
  rowSpacing: number;
  rotation: number;
};

type LayoutMetadata = {
  layoutName: string;
  renterName: string;
  eventType: string;
  guestCount: string;
  notes: string;
};

type SavedLayout = {
  id: string;
  name: string;
  selectedRoom: RoomKey;
  dividerMode: DividerMode;
  metadata: LayoutMetadata;
  roomTables: Record<RoomKey, TableItem[]>;
  roomChairs: Record<RoomKey, ChairItem[]>;
  roomChairRows: Record<RoomKey, ChairRowItem[]>;
  roomChairBlocks: Record<RoomKey, ChairBlockItem[]>;
  savedAt: string;
};

const STORAGE_KEY = "room-planner-layouts";

function normalizeTable(
  table: Partial<TableItem> &
    Omit<TableItem, "showAttachedChairs" | "seatCount" | "seatLayout">
): TableItem {
  return {
    ...table,
    showAttachedChairs: table.showAttachedChairs ?? false,
    seatCount: table.seatCount ?? 0,
    seatLayout: table.seatLayout ?? "none",
  };
}

function doBoundsOverlap(a: Bounds, b: Bounds) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function getRotatedBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number
): Bounds {
  const isVertical = rotation % 180 !== 0;
  const actualWidth = isVertical ? height : width;
  const actualHeight = isVertical ? width : height;

  return {
    left: x - actualWidth / 2,
    right: x + actualWidth / 2,
    top: y - actualHeight / 2,
    bottom: y + actualHeight / 2,
  };
}

export default function RoomCanvas() {
  const scale = 10;
  const gridSize = 0.5 * scale;
  const stageRef = useRef<any>(null);

  const rooms: Record<
    RoomKey,
    { name: string; widthFt: number; heightFt: number; dividerFt: number }
  > = {
    kinsmen: {
      name: "Kinsmen Room",
      widthFt: 29,
      heightFt: 46,
      dividerFt: 23,
    },
    accursi: {
      name: "Accursi Room",
      widthFt: 51.5,
      heightFt: 72,
      dividerFt: 36,
    },
  };

  const [selectedRoom, setSelectedRoom] = useState<RoomKey>("kinsmen");
  const [dividerMode, setDividerMode] = useState<DividerMode>("full");

  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedChairId, setSelectedChairId] = useState<number | null>(null);
  const [selectedChairRowId, setSelectedChairRowId] = useState<number | null>(null);
  const [selectedChairBlockId, setSelectedChairBlockId] = useState<number | null>(null);

  const [rowChairCount, setRowChairCount] = useState<number>(5);
  const [blockRows, setBlockRows] = useState<number>(5);
  const [blockCols, setBlockCols] = useState<number>(5);

  const [layoutName, setLayoutName] = useState("");
  const [renterName, setRenterName] = useState("");
  const [eventType, setEventType] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [notes, setNotes] = useState("");

  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([]);
  const [selectedSavedLayoutId, setSelectedSavedLayoutId] = useState("");

  const [roomTables, setRoomTables] = useState<Record<RoomKey, TableItem[]>>({
    kinsmen: [
      normalizeTable({
        id: 1,
        type: "rect",
        x: 80,
        y: 80,
        width: 6 * scale,
        height: 2.5 * scale,
        rotation: 0,
      }),
    ],
    accursi: [],
  });

  const [roomChairs, setRoomChairs] = useState<Record<RoomKey, ChairItem[]>>({
    kinsmen: [],
    accursi: [],
  });

  const [roomChairRows, setRoomChairRows] = useState<Record<RoomKey, ChairRowItem[]>>({
    kinsmen: [],
    accursi: [],
  });

  const [roomChairBlocks, setRoomChairBlocks] = useState<Record<RoomKey, ChairBlockItem[]>>({
    kinsmen: [],
    accursi: [],
  });

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed: SavedLayout[] = JSON.parse(raw);
      const normalized = parsed.map((layout) => ({
        ...layout,
        roomTables: {
          kinsmen: (layout.roomTables?.kinsmen ?? []).map((table) =>
            normalizeTable(table)
          ),
          accursi: (layout.roomTables?.accursi ?? []).map((table) =>
            normalizeTable(table)
          ),
        },
      }));
      setSavedLayouts(normalized);
    } catch (error) {
      console.error("Failed to load saved layouts:", error);
    }
  }, []);

  const tables = roomTables[selectedRoom];
  const chairs = roomChairs[selectedRoom];
  const chairRows = roomChairRows[selectedRoom];
  const chairBlocks = roomChairBlocks[selectedRoom];
  const room = rooms[selectedRoom];

  const width = room.widthFt * scale;
  const height = room.heightFt * scale;
  const dividerY = room.dividerFt * scale;

  const counts = useMemo(() => {
    const rectTables = tables.filter((t) => t.type === "rect").length;
    const squareTables = tables.filter((t) => t.type === "square").length;
    const roundTables = tables.filter((t) => t.type === "round").length;
    const highTopTables = tables.filter((t) => t.type === "highTop").length;

    const attachedChairsOnTables = tables.reduce(
      (sum, table) => sum + (table.showAttachedChairs ? table.seatCount : 0),
      0
    );

    const singleChairs = chairs.length;
    const chairRowGroups = chairRows.length;
    const chairsInRows = chairRows.reduce((sum, row) => sum + row.chairCount, 0);

    const chairBlockGroups = chairBlocks.length;
    const chairsInBlocks = chairBlocks.reduce(
      (sum, block) => sum + block.rows * block.cols,
      0
    );

    const totalChairs =
      singleChairs + chairsInRows + chairsInBlocks + attachedChairsOnTables;

    const totalTables = rectTables + squareTables + roundTables + highTopTables;

    return {
      rectTables,
      squareTables,
      roundTables,
      highTopTables,
      totalTables,
      attachedChairsOnTables,
      singleChairs,
      chairRowGroups,
      chairsInRows,
      chairBlockGroups,
      chairsInBlocks,
      totalChairs,
    };
  }, [tables, chairs, chairRows, chairBlocks]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (isTyping) return;

      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        deleteSelectedItem();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelectedItem();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedTableId,
    selectedChairId,
    selectedChairRowId,
    selectedChairBlockId,
    tables,
    chairs,
    chairRows,
    chairBlocks,
    selectedRoom,
  ]);

  function persistLayouts(layouts: SavedLayout[]) {
    setSavedLayouts(layouts);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  }

  function snapToGrid(value: number) {
    return Math.round(value / gridSize) * gridSize;
  }

  function snapPoint(x: number, y: number) {
    return {
      x: snapToGrid(x),
      y: snapToGrid(y),
    };
  }

  function getActiveBounds() {
    if (dividerMode === "full") {
      return { minX: 0, maxX: width, minY: 0, maxY: height };
    }

    if (dividerMode === "top") {
      return { minX: 0, maxX: width, minY: 0, maxY: dividerY };
    }

    return { minX: 0, maxX: width, minY: dividerY, maxY: height };
  }

  function getDefaultSpawnPoint() {
    const bounds = getActiveBounds();
    return snapPoint((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
  }

  function clearSelection() {
    setSelectedTableId(null);
    setSelectedChairId(null);
    setSelectedChairRowId(null);
    setSelectedChairBlockId(null);
  }

  function selectOnly(type: "table" | "chair" | "chairRow" | "chairBlock", id: number) {
    setSelectedTableId(type === "table" ? id : null);
    setSelectedChairId(type === "chair" ? id : null);
    setSelectedChairRowId(type === "chairRow" ? id : null);
    setSelectedChairBlockId(type === "chairBlock" ? id : null);
  }

  function clearMetadataInputs() {
    setLayoutName("");
    setRenterName("");
    setEventType("");
    setGuestCount("");
    setNotes("");
  }

  function resetCurrentRoomToBlank() {
    setRoomTables((prev) => ({
      ...prev,
      [selectedRoom]: [],
    }));

    setRoomChairs((prev) => ({
      ...prev,
      [selectedRoom]: [],
    }));

    setRoomChairRows((prev) => ({
      ...prev,
      [selectedRoom]: [],
    }));

    setRoomChairBlocks((prev) => ({
      ...prev,
      [selectedRoom]: [],
    }));

    clearSelection();
  }

  function getTableCollisionBounds(table: TableItem): Bounds {
    const chairWidth = 1.75 * scale;
    const chairHeight = 1.5 * scale;
    const padding = 0.05 * scale;
  
    let left = -table.width / 2;
    let right = table.width / 2;
    let top = -table.height / 2;
    let bottom = table.height / 2;
  
    const attachedChairs = getAttachedChairPositions(table);
  
    attachedChairs.forEach((chair) => {
      const isVertical = chair.rotation % 180 !== 0;
      const actualChairWidth = isVertical ? chairHeight : chairWidth;
      const actualChairHeight = isVertical ? chairWidth : chairHeight;
  
      left = Math.min(left, chair.x - actualChairWidth / 2);
      right = Math.max(right, chair.x + actualChairWidth / 2);
      top = Math.min(top, chair.y - actualChairHeight / 2);
      bottom = Math.max(bottom, chair.y + actualChairHeight / 2);
    });
  
    const localWidth = right - left + padding * 2;
    const localHeight = bottom - top + padding * 2;
  
    const localCenterX = (left + right) / 2;
    const localCenterY = (top + bottom) / 2;
  
    const radians = (table.rotation * Math.PI) / 180;
  
    const rotatedCenterX =
      localCenterX * Math.cos(radians) - localCenterY * Math.sin(radians);
  
    const rotatedCenterY =
      localCenterX * Math.sin(radians) + localCenterY * Math.cos(radians);
  
    return getRotatedBounds(
      table.x + rotatedCenterX,
      table.y + rotatedCenterY,
      localWidth,
      localHeight,
      table.rotation
    );
  }

  function getChairCollisionBounds(chair: ChairItem): Bounds {
    return getRotatedBounds(
      chair.x,
      chair.y,
      chair.width + 0.1 * scale,
      chair.height + 0.1 * scale,
      chair.rotation
    );
  }

  function getChairRowCollisionBounds(row: ChairRowItem): Bounds {
    const totalWidth =
      row.chairCount * row.chairWidth + (row.chairCount - 1) * row.spacing;
    const totalHeight = row.chairHeight;

    return getRotatedBounds(
      row.x,
      row.y,
      totalWidth + 0.15 * scale,
      totalHeight + 0.15 * scale,
      row.rotation
    );
  }

  function getChairBlockCollisionBounds(block: ChairBlockItem): Bounds {
    const totalWidth =
      block.cols * block.chairWidth + (block.cols - 1) * block.colSpacing;
    const totalHeight =
      block.rows * block.chairHeight + (block.rows - 1) * block.rowSpacing;

    return getRotatedBounds(
      block.x,
      block.y,
      totalWidth + 0.15 * scale,
      totalHeight + 0.15 * scale,
      block.rotation
    );
  }

  function wouldOverlap(
    candidateBounds: Bounds,
    ignore: { type: "table" | "chair" | "chairRow" | "chairBlock"; id: number }
  ) {
    const tableOverlap = tables.some((table) => {
      if (ignore.type === "table" && table.id === ignore.id) return false;
      return doBoundsOverlap(candidateBounds, getTableCollisionBounds(table));
    });

    if (tableOverlap) return true;

    const chairOverlap = chairs.some((chair) => {
      if (ignore.type === "chair" && chair.id === ignore.id) return false;
      return doBoundsOverlap(candidateBounds, getChairCollisionBounds(chair));
    });

    if (chairOverlap) return true;

    const rowOverlap = chairRows.some((row) => {
      if (ignore.type === "chairRow" && row.id === ignore.id) return false;
      return doBoundsOverlap(candidateBounds, getChairRowCollisionBounds(row));
    });

    if (rowOverlap) return true;

    const blockOverlap = chairBlocks.some((block) => {
      if (ignore.type === "chairBlock" && block.id === ignore.id) return false;
      return doBoundsOverlap(candidateBounds, getChairBlockCollisionBounds(block));
    });

    return blockOverlap;
  }

  function deleteSelectedItem() {
    if (selectedTableId !== null) {
      setRoomTables((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].filter(
          (table) => table.id !== selectedTableId
        ),
      }));
      setSelectedTableId(null);
      return;
    }

    if (selectedChairId !== null) {
      setRoomChairs((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].filter(
          (chair) => chair.id !== selectedChairId
        ),
      }));
      setSelectedChairId(null);
      return;
    }

    if (selectedChairRowId !== null) {
      setRoomChairRows((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].filter(
          (row) => row.id !== selectedChairRowId
        ),
      }));
      setSelectedChairRowId(null);
      return;
    }

    if (selectedChairBlockId !== null) {
      setRoomChairBlocks((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].filter(
          (block) => block.id !== selectedChairBlockId
        ),
      }));
      setSelectedChairBlockId(null);
    }
  }

  function duplicateSelectedItem() {
    const offset = snapToGrid(2 * scale);

    if (selectedTableId !== null) {
      const table = tables.find((item) => item.id === selectedTableId);
      if (!table) return;

      const copy = {
        ...table,
        id: Date.now(),
        x: snapToGrid(table.x + offset),
        y: snapToGrid(table.y + offset),
      };

      setRoomTables((prev) => ({
        ...prev,
        [selectedRoom]: [...prev[selectedRoom], copy],
      }));

      selectOnly("table", copy.id);
      return;
    }

    if (selectedChairId !== null) {
      const chair = chairs.find((item) => item.id === selectedChairId);
      if (!chair) return;

      const copy = {
        ...chair,
        id: Date.now(),
        x: snapToGrid(chair.x + offset),
        y: snapToGrid(chair.y + offset),
      };

      setRoomChairs((prev) => ({
        ...prev,
        [selectedRoom]: [...prev[selectedRoom], copy],
      }));

      selectOnly("chair", copy.id);
      return;
    }

    if (selectedChairRowId !== null) {
      const row = chairRows.find((item) => item.id === selectedChairRowId);
      if (!row) return;

      const copy = {
        ...row,
        id: Date.now(),
        x: snapToGrid(row.x + offset),
        y: snapToGrid(row.y + offset),
      };

      setRoomChairRows((prev) => ({
        ...prev,
        [selectedRoom]: [...prev[selectedRoom], copy],
      }));

      selectOnly("chairRow", copy.id);
      return;
    }

    if (selectedChairBlockId !== null) {
      const block = chairBlocks.find((item) => item.id === selectedChairBlockId);
      if (!block) return;

      const copy = {
        ...block,
        id: Date.now(),
        x: snapToGrid(block.x + offset),
        y: snapToGrid(block.y + offset),
      };

      setRoomChairBlocks((prev) => ({
        ...prev,
        [selectedRoom]: [...prev[selectedRoom], copy],
      }));

      selectOnly("chairBlock", copy.id);
    }
  }

  async function exportAsPdf() {
    if (!stageRef.current) return;

    clearSelection();

    await new Promise((resolve) => requestAnimationFrame(resolve));

    const stageDataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });

    const title = layoutName.trim() || `${rooms[selectedRoom].name} Setup`;

    const topLabel =
      selectedRoom === "accursi"
        ? "Window side"
        : dividerMode === "full"
        ? ""
        : "Top Half";

    const bottomLabel =
      selectedRoom === "accursi"
        ? "B Side"
        : dividerMode === "full"
        ? ""
        : "Bottom Half";

    const modeLabel = dividerMode === "full" ? "Full Room" : "Half Room";

    const printWindow = window.open("", "_blank", "width=1200,height=900");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page {
              size: letter landscape;
              margin: 8mm;
            }
            html, body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              color: #111;
              background: white;
            }
            body {
              font-size: 11px;
              line-height: 1.25;
            }
            * {
              box-sizing: border-box;
            }
            .page {
              padding: 4px;
            }
            .title {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 2px;
            }
            .subtitle {
              font-size: 11px;
              color: #444;
              margin-bottom: 8px;
            }
            .main-grid {
              display: grid;
              grid-template-columns: 2.1fr 1fr;
              gap: 10px;
              align-items: start;
            }
            .room-wrap {
              border: 2px solid #111;
              padding: 8px;
              background: white;
            }
            .orientation {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .room-image {
              display: block;
              width: 100%;
              max-height: 520px;
              object-fit: contain;
              border: 2px solid #111;
              background: white;
            }
            .side-stack {
              display: grid;
              grid-template-rows: auto auto;
              gap: 8px;
            }
            .card {
              border: 1px solid #ccc;
              padding: 8px;
              border-radius: 4px;
              break-inside: avoid;
            }
            .card-title {
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 4px;
            }
            .line {
              margin: 2px 0;
              font-size: 11px;
            }
            .small {
              font-size: 10px;
              color: #666;
              margin-top: 6px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="title">${title}</div>
            <div class="subtitle">
              Room: ${rooms[selectedRoom].name} | ${modeLabel}
            </div>

            <div class="main-grid">
              <div class="room-wrap">
                <div class="orientation">
                  <div>${topLabel}</div>
                  <div></div>
                </div>

                <img class="room-image" src="${stageDataUrl}" />

                <div class="orientation" style="margin-top: 4px;">
                  <div>${bottomLabel}</div>
                  <div></div>
                </div>
              </div>

              <div class="side-stack">
                <div class="card">
                  <div class="card-title">Layout Details</div>
                  <div class="line"><strong>Layout Name:</strong> ${layoutName || "-"}</div>
                  <div class="line"><strong>Renter:</strong> ${renterName || "-"}</div>
                  <div class="line"><strong>Event Type:</strong> ${eventType || "-"}</div>
                  <div class="line"><strong>Guest Count:</strong> ${guestCount || "-"}</div>
                  <div class="line"><strong>Notes:</strong> ${notes || "-"}</div>
                </div>

                <div class="card">
                  <div class="card-title">Legend / Counts</div>
                  <div class="line"><strong>Rectangular Tables:</strong> ${counts.rectTables}</div>
                  <div class="line"><strong>Square Tables:</strong> ${counts.squareTables}</div>
                  <div class="line"><strong>Round Tables:</strong> ${counts.roundTables}</div>
                  <div class="line"><strong>High Top Tables:</strong> ${counts.highTopTables}</div>
                  <div class="line"><strong>Total Tables:</strong> ${counts.totalTables}</div>
                  <div class="line"><strong>Attached Chairs on Tables:</strong> ${counts.attachedChairsOnTables}</div>
                  <div class="line"><strong>Single Chairs:</strong> ${counts.singleChairs}</div>
                  <div class="line"><strong>Chair Row Groups:</strong> ${counts.chairRowGroups}</div>
                  <div class="line"><strong>Chairs in Rows:</strong> ${counts.chairsInRows}</div>
                  <div class="line"><strong>Chair Block Groups:</strong> ${counts.chairBlockGroups}</div>
                  <div class="line"><strong>Chairs in Blocks:</strong> ${counts.chairsInBlocks}</div>
                  <div class="line"><strong>Total Chairs:</strong> ${counts.totalChairs}</div>
                </div>
              </div>
            </div>

            <div class="small">
              Generated ${new Date().toLocaleString()}
            </div>
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  function buildCurrentLayout(idOverride?: string): SavedLayout | null {
    const trimmedName = layoutName.trim();
    if (!trimmedName) return null;

    return {
      id: idOverride ?? crypto.randomUUID(),
      name: trimmedName,
      selectedRoom,
      dividerMode,
      metadata: {
        layoutName: trimmedName,
        renterName: renterName.trim(),
        eventType: eventType.trim(),
        guestCount: guestCount.trim(),
        notes: notes.trim(),
      },
      roomTables,
      roomChairs,
      roomChairRows,
      roomChairBlocks,
      savedAt: new Date().toISOString(),
    };
  }

  function saveCurrentLayout() {
    const newLayout = buildCurrentLayout();
    if (!newLayout) return;

    const updatedLayouts = [newLayout, ...savedLayouts];
    persistLayouts(updatedLayouts);
    clearMetadataInputs();
    setSelectedSavedLayoutId(newLayout.id);
    resetCurrentRoomToBlank();
  }

  function updateSavedLayout() {
    if (!selectedSavedLayoutId) return;

    const existing = savedLayouts.find((layout) => layout.id === selectedSavedLayoutId);
    if (!existing) return;

    const updatedLayout = buildCurrentLayout(existing.id);
    if (!updatedLayout) return;

    const updatedLayouts = savedLayouts.map((layout) =>
      layout.id === selectedSavedLayoutId ? updatedLayout : layout
    );

    persistLayouts(updatedLayouts);
  }

  function loadSelectedLayout() {
    if (!selectedSavedLayoutId) return;

    const layout = savedLayouts.find((item) => item.id === selectedSavedLayoutId);
    if (!layout) return;

    const normalizedTables = {
      kinsmen: (layout.roomTables?.kinsmen ?? []).map((table) =>
        normalizeTable(table)
      ),
      accursi: (layout.roomTables?.accursi ?? []).map((table) =>
        normalizeTable(table)
      ),
    };

    setSelectedRoom(layout.selectedRoom);
    setDividerMode(layout.dividerMode ?? "full");
    setRoomTables(normalizedTables);
    setRoomChairs(layout.roomChairs);
    setRoomChairRows(layout.roomChairRows);
    setRoomChairBlocks(layout.roomChairBlocks);

    setLayoutName(layout.metadata?.layoutName ?? layout.name);
    setRenterName(layout.metadata?.renterName ?? "");
    setEventType(layout.metadata?.eventType ?? "");
    setGuestCount(layout.metadata?.guestCount ?? "");
    setNotes(layout.metadata?.notes ?? "");

    clearSelection();
  }

  function deleteSelectedLayout() {
    if (!selectedSavedLayoutId) return;

    const updatedLayouts = savedLayouts.filter(
      (layout) => layout.id !== selectedSavedLayoutId
    );

    persistLayouts(updatedLayouts);
    setSelectedSavedLayoutId("");
  }

  function clampRectLikePosition(
    item: { width: number; height: number; rotation: number },
    newX: number,
    newY: number
  ) {
    const bounds = getActiveBounds();

    const isVertical = item.rotation % 180 !== 0;
    const rotatedWidth = isVertical ? item.height : item.width;
    const rotatedHeight = isVertical ? item.width : item.height;

    const halfW = rotatedWidth / 2;
    const halfH = rotatedHeight / 2;

    const clampedX = Math.max(bounds.minX + halfW, Math.min(newX, bounds.maxX - halfW));
    const clampedY = Math.max(bounds.minY + halfH, Math.min(newY, bounds.maxY - halfH));

    return { x: clampedX, y: clampedY };
  }

  function clampTablePosition(table: TableItem, newX: number, newY: number) {
    const bounds = getActiveBounds();
    const isCircular = table.type === "round" || table.type === "highTop";

    if (isCircular) {
      const halfW = table.width / 2;
      const halfH = table.height / 2;

      return {
        x: Math.max(bounds.minX + halfW, Math.min(newX, bounds.maxX - halfW)),
        y: Math.max(bounds.minY + halfH, Math.min(newY, bounds.maxY - halfH)),
      };
    }

    return clampRectLikePosition(table, newX, newY);
  }

  function clampChairPosition(chair: ChairItem, newX: number, newY: number) {
    return clampRectLikePosition(chair, newX, newY);
  }

  function getChairRowBounds(row: ChairRowItem) {
    const totalWidth =
      row.chairCount * row.chairWidth + (row.chairCount - 1) * row.spacing;
    const totalHeight = row.chairHeight;

    const isVertical = row.rotation % 180 !== 0;

    return {
      width: isVertical ? totalHeight : totalWidth,
      height: isVertical ? totalWidth : totalHeight,
    };
  }

  function clampChairRowPosition(row: ChairRowItem, newX: number, newY: number) {
    const bounds = getActiveBounds();
    const rowBounds = getChairRowBounds(row);

    const halfW = rowBounds.width / 2;
    const halfH = rowBounds.height / 2;

    return {
      x: Math.max(bounds.minX + halfW, Math.min(newX, bounds.maxX - halfW)),
      y: Math.max(bounds.minY + halfH, Math.min(newY, bounds.maxY - halfH)),
    };
  }

  function getChairBlockBounds(block: ChairBlockItem) {
    const totalWidth =
      block.cols * block.chairWidth + (block.cols - 1) * block.colSpacing;
    const totalHeight =
      block.rows * block.chairHeight + (block.rows - 1) * block.rowSpacing;

    const isVertical = block.rotation % 180 !== 0;

    return {
      width: isVertical ? totalHeight : totalWidth,
      height: isVertical ? totalWidth : totalHeight,
    };
  }

  function clampChairBlockPosition(
    block: ChairBlockItem,
    newX: number,
    newY: number
  ) {
    const bounds = getActiveBounds();
    const blockBounds = getChairBlockBounds(block);

    const halfW = blockBounds.width / 2;
    const halfH = blockBounds.height / 2;

    return {
      x: Math.max(bounds.minX + halfW, Math.min(newX, bounds.maxX - halfW)),
      y: Math.max(bounds.minY + halfH, Math.min(newY, bounds.maxY - halfH)),
    };
  }

  function updateTablePosition(id: number, newX: number, newY: number) {
    const table = tables.find((item) => item.id === id);
    if (!table) return false;

    const snapped = snapPoint(newX, newY);
    const candidateTable = {
      ...table,
      x: snapped.x,
      y: snapped.y,
    };

    const candidateBounds = getTableCollisionBounds(candidateTable);

    if (wouldOverlap(candidateBounds, { type: "table", id })) {
      return false;
    }

    setRoomTables((prev) => ({
      ...prev,
      [selectedRoom]: prev[selectedRoom].map((table) =>
        table.id === id ? { ...table, x: snapped.x, y: snapped.y } : table
      ),
    }));

    return true;
  }

  function updateChairPosition(id: number, newX: number, newY: number) {
    const chair = chairs.find((item) => item.id === id);
    if (!chair) return false;

    const snapped = snapPoint(newX, newY);
    const candidateChair = {
      ...chair,
      x: snapped.x,
      y: snapped.y,
    };

    const candidateBounds = getChairCollisionBounds(candidateChair);

    if (wouldOverlap(candidateBounds, { type: "chair", id })) {
      return false;
    }

    setRoomChairs((prev) => ({
      ...prev,
      [selectedRoom]: prev[selectedRoom].map((chair) =>
        chair.id === id ? { ...chair, x: snapped.x, y: snapped.y } : chair
      ),
    }));

    return true;
  }

  function updateChairRowPosition(id: number, newX: number, newY: number) {
    const row = chairRows.find((item) => item.id === id);
    if (!row) return false;

    const snapped = snapPoint(newX, newY);
    const candidateRow = {
      ...row,
      x: snapped.x,
      y: snapped.y,
    };

    const candidateBounds = getChairRowCollisionBounds(candidateRow);

    if (wouldOverlap(candidateBounds, { type: "chairRow", id })) {
      return false;
    }

    setRoomChairRows((prev) => ({
      ...prev,
      [selectedRoom]: prev[selectedRoom].map((row) =>
        row.id === id ? { ...row, x: snapped.x, y: snapped.y } : row
      ),
    }));

    return true;
  }

  function updateChairBlockPosition(id: number, newX: number, newY: number) {
    const block = chairBlocks.find((item) => item.id === id);
    if (!block) return false;

    const snapped = snapPoint(newX, newY);
    const candidateBlock = {
      ...block,
      x: snapped.x,
      y: snapped.y,
    };

    const candidateBounds = getChairBlockCollisionBounds(candidateBlock);

    if (wouldOverlap(candidateBounds, { type: "chairBlock", id })) {
      return false;
    }

    setRoomChairBlocks((prev) => ({
      ...prev,
      [selectedRoom]: prev[selectedRoom].map((block) =>
        block.id === id ? { ...block, x: snapped.x, y: snapped.y } : block
      ),
    }));

    return true;
  }

  function rotateSelectedItem() {
    if (selectedTableId !== null) {
      setRoomTables((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].map((table) => {
          if (table.id !== selectedTableId) return table;

          if (table.type === "round" || table.type === "highTop") {
            return table;
          }

          const rotatedTable = {
            ...table,
            rotation: (table.rotation + 90) % 360,
          };

          const clamped = clampTablePosition(
            rotatedTable,
            rotatedTable.x,
            rotatedTable.y
          );

          const candidateBounds = getTableCollisionBounds({
            ...rotatedTable,
            x: clamped.x,
            y: clamped.y,
          });

          if (wouldOverlap(candidateBounds, { type: "table", id: table.id })) {
            return table;
          }

          return {
            ...rotatedTable,
            x: clamped.x,
            y: clamped.y,
          };
        }),
      }));
      return;
    }

    if (selectedChairId !== null) {
      setRoomChairs((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].map((chair) => {
          if (chair.id !== selectedChairId) return chair;

          const rotatedChair = {
            ...chair,
            rotation: (chair.rotation + 90) % 360,
          };

          const clamped = clampChairPosition(
            rotatedChair,
            rotatedChair.x,
            rotatedChair.y
          );

          const candidateBounds = getChairCollisionBounds({
            ...rotatedChair,
            x: clamped.x,
            y: clamped.y,
          });

          if (wouldOverlap(candidateBounds, { type: "chair", id: chair.id })) {
            return chair;
          }

          return {
            ...rotatedChair,
            x: clamped.x,
            y: clamped.y,
          };
        }),
      }));
      return;
    }

    if (selectedChairRowId !== null) {
      setRoomChairRows((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].map((row) => {
          if (row.id !== selectedChairRowId) return row;

          const rotatedRow = {
            ...row,
            rotation: (row.rotation + 90) % 360,
          };

          const clamped = clampChairRowPosition(
            rotatedRow,
            rotatedRow.x,
            rotatedRow.y
          );

          const candidateBounds = getChairRowCollisionBounds({
            ...rotatedRow,
            x: clamped.x,
            y: clamped.y,
          });

          if (wouldOverlap(candidateBounds, { type: "chairRow", id: row.id })) {
            return row;
          }

          return {
            ...rotatedRow,
            x: clamped.x,
            y: clamped.y,
          };
        }),
      }));
      return;
    }

    if (selectedChairBlockId !== null) {
      setRoomChairBlocks((prev) => ({
        ...prev,
        [selectedRoom]: prev[selectedRoom].map((block) => {
          if (block.id !== selectedChairBlockId) return block;

          const rotatedBlock = {
            ...block,
            rotation: (block.rotation + 90) % 360,
          };

          const clamped = clampChairBlockPosition(
            rotatedBlock,
            rotatedBlock.x,
            rotatedBlock.y
          );

          const candidateBounds = getChairBlockCollisionBounds({
            ...rotatedBlock,
            x: clamped.x,
            y: clamped.y,
          });

          if (wouldOverlap(candidateBounds, { type: "chairBlock", id: block.id })) {
            return block;
          }

          return {
            ...rotatedBlock,
            x: clamped.x,
            y: clamped.y,
          };
        }),
      }));
    }
  }

  function getDisplayNumber(tableId: number) {
    const index = tables.findIndex((table) => table.id === tableId);
    return index + 1;
  }

  function getTableFillColor(type: TableType) {
    if (type === "highTop") return "#2563eb";
    return "blue";
  }

  function getTableLabel(type: TableType) {
    if (type === "round") return "R";
    if (type === "highTop") return "H";
    if (type === "square") return "S";
    return "";
  }

  function promptForTableSeating(
    tableType: TableType
  ): { seatCount: number; seatLayout: SeatLayout; showAttachedChairs: boolean } {
    if (tableType === "highTop") {
      alert("High top tables do not allow attached chairs in this version.");
      return {
        seatCount: 0,
        seatLayout: "none",
        showAttachedChairs: false,
      };
    }

    if (tableType === "round") {
      const countInput = window.prompt(
        "How many chairs for this round table? (0-8)",
        "8"
      );
      if (countInput === null) {
        return { seatCount: 0, seatLayout: "none", showAttachedChairs: false };
      }

      const parsed = Number(countInput);
      const seatCount = Number.isFinite(parsed)
        ? Math.max(0, Math.min(8, Math.floor(parsed)))
        : 0;

      return {
        seatCount,
        seatLayout: seatCount > 0 ? "even" : "none",
        showAttachedChairs: seatCount > 0,
      };
    }

    if (tableType === "square") {
      const countInput = window.prompt(
        "How many chairs for this square table? (0-4)",
        "4"
      );
      if (countInput === null) {
        return { seatCount: 0, seatLayout: "none", showAttachedChairs: false };
      }

      const parsed = Number(countInput);
      const seatCount = Number.isFinite(parsed)
        ? Math.max(0, Math.min(4, Math.floor(parsed)))
        : 0;

      return {
        seatCount,
        seatLayout: seatCount > 0 ? "even" : "none",
        showAttachedChairs: seatCount > 0,
      };
    }

    const countInput = window.prompt(
      "How many chairs for this rectangular table? (0-8)",
      "6"
    );
    if (countInput === null) {
      return { seatCount: 0, seatLayout: "none", showAttachedChairs: false };
    }

    const parsed = Number(countInput);
    const seatCount = Number.isFinite(parsed)
      ? Math.max(0, Math.min(8, Math.floor(parsed)))
      : 0;

    if (seatCount === 0) {
      return {
        seatCount: 0,
        seatLayout: "none",
        showAttachedChairs: false,
      };
    }

    const layoutInput = window.prompt(
      'Orientation for this rectangular table: type "one" for one side only (max 4), or "even" for evenly spread (max 8).',
      "even"
    );

    const rawLayout = (layoutInput ?? "even").trim().toLowerCase();
    const seatLayout: SeatLayout = rawLayout === "one" ? "oneSide" : "even";

    const clampedSeatCount =
      seatLayout === "oneSide"
        ? Math.max(0, Math.min(4, seatCount))
        : Math.max(0, Math.min(8, seatCount));

    return {
      seatCount: clampedSeatCount,
      seatLayout: clampedSeatCount > 0 ? seatLayout : "none",
      showAttachedChairs: clampedSeatCount > 0,
    };
  }

  function getAttachedChairPositions(table: TableItem) {
    const chairWidth = 1.75 * scale;
    const chairHeight = 1.5 * scale;
    const sideGap = 0.35 * scale;
    const endGap = 0.35 * scale;

    if (!table.showAttachedChairs || table.seatCount <= 0) return [];

    if (table.type === "highTop") return [];

    if (table.type === "round") {
      const seatCount = Math.min(table.seatCount, 8);
      const radius = table.width / 2 + chairHeight / 2 + 0.35 * scale;

      return Array.from({ length: seatCount }).map((_, index) => {
        const angle = (Math.PI * 2 * index) / seatCount - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const rotation = (angle * 180) / Math.PI + 90;
        return { x, y, rotation };
      });
    }

    if (table.type === "square") {
      const seatCount = Math.min(table.seatCount, 4);
      const allPositions = [
        { x: 0, y: -table.height / 2 - chairHeight / 2 - sideGap, rotation: 0 },
        { x: table.width / 2 + chairHeight / 2 + sideGap, y: 0, rotation: 90 },
        { x: 0, y: table.height / 2 + chairHeight / 2 + sideGap, rotation: 180 },
        { x: -table.width / 2 - chairHeight / 2 - sideGap, y: 0, rotation: 270 },
      ];

      if (seatCount === 1) return [allPositions[0]];
      if (seatCount === 2) return [allPositions[0], allPositions[2]];
      if (seatCount === 3) return [allPositions[0], allPositions[1], allPositions[2]];
      return allPositions;
    }

    const seatCount =
      table.seatLayout === "oneSide"
        ? Math.min(table.seatCount, 4)
        : Math.min(table.seatCount, 8);

    if (table.seatLayout === "oneSide") {
      return Array.from({ length: seatCount }).map((_, i) => {
        const spacing = table.width / (seatCount + 1);
        return {
          x: -table.width / 2 + spacing * (i + 1),
          y: -table.height / 2 - chairHeight / 2 - sideGap,
          rotation: 0,
        };
      });
    }

    const positions: { x: number; y: number; rotation: number }[] = [];

    const addTopChairs = (count: number) => {
      const spacing = table.width / (count + 1);
      for (let i = 0; i < count; i++) {
        positions.push({
          x: -table.width / 2 + spacing * (i + 1),
          y: -table.height / 2 - chairHeight / 2 - sideGap,
          rotation: 0,
        });
      }
    };

    const addBottomChairs = (count: number) => {
      const spacing = table.width / (count + 1);
      for (let i = 0; i < count; i++) {
        positions.push({
          x: -table.width / 2 + spacing * (i + 1),
          y: table.height / 2 + chairHeight / 2 + sideGap,
          rotation: 180,
        });
      }
    };

    if (seatCount === 1) {
      addTopChairs(1);
    } else if (seatCount === 2) {
      addTopChairs(1);
      addBottomChairs(1);
    } else if (seatCount === 3) {
      addTopChairs(2);
      addBottomChairs(1);
    } else if (seatCount === 4) {
      addTopChairs(2);
      addBottomChairs(2);
    } else if (seatCount === 5) {
      addTopChairs(3);
      addBottomChairs(2);
    } else if (seatCount === 6) {
      addTopChairs(3);
      addBottomChairs(3);
    } else if (seatCount === 7) {
      addTopChairs(3);
      addBottomChairs(3);
      positions.push({
        x: -table.width / 2 - chairHeight / 2 - endGap,
        y: 0,
        rotation: 270,
      });
    } else if (seatCount >= 8) {
      addTopChairs(3);
      addBottomChairs(3);
      positions.push({
        x: -table.width / 2 - chairHeight / 2 - endGap,
        y: 0,
        rotation: 270,
      });
      positions.push({
        x: table.width / 2 + chairHeight / 2 + endGap,
        y: 0,
        rotation: 90,
      });
    }

    return positions;
  }

  function addRectTable() {
    const spawn = getDefaultSpawnPoint();
    const seating = promptForTableSeating("rect");

    const newTable = normalizeTable({
      id: Date.now(),
      type: "rect",
      x: spawn.x,
      y: spawn.y,
      width: 6 * scale,
      height: 2.5 * scale,
      rotation: 0,
      showAttachedChairs: seating.showAttachedChairs,
      seatCount: seating.seatCount,
      seatLayout: seating.seatLayout,
    });

    const clamped = clampTablePosition(newTable, newTable.x, newTable.y);
    const candidateTable = { ...newTable, ...clamped };

    setRoomTables((prev) => ({
      ...prev,
      [selectedRoom]: [...prev[selectedRoom], candidateTable],
    }));

    selectOnly("table", newTable.id);
  }

  function addSquareTable() {
    const spawn = getDefaultSpawnPoint();
    const size = 3 * scale;
    const seating = promptForTableSeating("square");

    const newTable = normalizeTable({
      id: Date.now(),
      type: "square",
      x: spawn.x,
      y: spawn.y,
      width: size,
      height: size,
      rotation: 0,
      showAttachedChairs: seating.showAttachedChairs,
      seatCount: seating.seatCount,
      seatLayout: seating.seatLayout,
    });

    const clamped = clampTablePosition(newTable, newTable.x, newTable.y);
    const candidateTable = { ...newTable, ...clamped };

    setRoomTables((prev) => ({
      ...prev,
      [selectedRoom]: [...prev[selectedRoom], candidateTable],
    }));

    selectOnly("table", newTable.id);
  }

  function addRoundTable() {
    const spawn = getDefaultSpawnPoint();
    const diameter = 5 * scale;
    const seating = promptForTableSeating("round");

    const newTable = normalizeTable({
      id: Date.now(),
      type: "round",
      x: spawn.x,
      y: spawn.y,
      width: diameter,
      height: diameter,
      rotation: 0,
      showAttachedChairs: seating.showAttachedChairs,
      seatCount: seating.seatCount,
      seatLayout: seating.seatLayout,
    });

    const clamped = clampTablePosition(newTable, newTable.x, newTable.y);
    const candidateTable = { ...newTable, ...clamped };

    setRoomTables((prev) => ({
      ...prev,
      [selectedRoom]: [...prev[selectedRoom], candidateTable],
    }));

    selectOnly("table", newTable.id);
  }

  function addHighTopTable() {
    const spawn = getDefaultSpawnPoint();
    const diameter = (32 / 12) * scale;
    const seating = promptForTableSeating("highTop");

    const newTable = normalizeTable({
      id: Date.now(),
      type: "highTop",
      x: spawn.x,
      y: spawn.y,
      width: diameter,
      height: diameter,
      rotation: 0,
      showAttachedChairs: seating.showAttachedChairs,
      seatCount: seating.seatCount,
      seatLayout: seating.seatLayout,
    });

    const clamped = clampTablePosition(newTable, newTable.x, newTable.y);
    const candidateTable = { ...newTable, ...clamped };

    setRoomTables((prev) => ({
      ...prev,
      [selectedRoom]: [...prev[selectedRoom], candidateTable],
    }));

    selectOnly("table", newTable.id);
  }

  function addChair() {
    const spawn = getDefaultSpawnPoint();

    const newChair: ChairItem = {
      id: Date.now(),
      x: spawn.x,
      y: spawn.y,
      width: 1.75 * scale,
      height: 1.5 * scale,
      rotation: 0,
    };

    const clamped = clampChairPosition(newChair, newChair.x, newChair.y);
    const candidateChair = { ...newChair, ...clamped };

    setRoomChairs((prev) => ({
      ...prev,
      [selectedRoom]: [...prev[selectedRoom], candidateChair],
    }));

    selectOnly("chair", newChair.id);
  }

  function addChairRow() {
    const spawn = getDefaultSpawnPoint();
    const safeCount = Math.max(1, rowChairCount);

    const newChairRow: ChairRowItem = {
      id: Date.now(),
      x: spawn.x,
      y: spawn.y,
      chairCount: safeCount,
      chairWidth: 1.75 * scale,
      chairHeight: 1.5 * scale,
      spacing: 0.8 * scale,
      rotation: 0,
    };

    const clamped = clampChairRowPosition(newChairRow, newChairRow.x, newChairRow.y);
    const candidateRow = { ...newChairRow, ...clamped };

    setRoomChairRows((prev) => ({
      ...prev,
      [selectedRoom]: [...prev[selectedRoom], candidateRow],
    }));

    selectOnly("chairRow", newChairRow.id);
  }

  function addChairBlock() {
    const spawn = getDefaultSpawnPoint();
    const safeRows = Math.max(1, blockRows);
    const safeCols = Math.max(1, blockCols);

    const newChairBlock: ChairBlockItem = {
      id: Date.now(),
      x: spawn.x,
      y: spawn.y,
      rows: safeRows,
      cols: safeCols,
      chairWidth: 1.75 * scale,
      chairHeight: 1.5 * scale,
      colSpacing: 0.8 * scale,
      rowSpacing: 1.0 * scale,
      rotation: 0,
    };

    const clamped = clampChairBlockPosition(newChairBlock, newChairBlock.x, newChairBlock.y);
    const candidateBlock = { ...newChairBlock, ...clamped };

    setRoomChairBlocks((prev) => ({
      ...prev,
      [selectedRoom]: [...prev[selectedRoom], candidateBlock],
    }));

    selectOnly("chairBlock", newChairBlock.id);
  }

  return (
    <div className="min-h-screen flex flex-col items-center gap-6 bg-gray-100 text-black p-6">
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg shadow">
        <select
          value={selectedRoom}
          onChange={(e) => {
            setSelectedRoom(e.target.value as RoomKey);
            clearSelection();
          }}
          className="border border-gray-400 bg-white text-black p-2 rounded"
        >
          <option value="kinsmen">Kinsmen Room</option>
          <option value="accursi">Accursi Room</option>
        </select>

        <select
          value={dividerMode}
          onChange={(e) => setDividerMode(e.target.value as DividerMode)}
          className="border border-gray-400 bg-white text-black p-2 rounded"
        >
          <option value="full">Full Room</option>
          <option value="top">Top Half</option>
          <option value="bottom">Bottom Half</option>
        </select>

        <button onClick={addRectTable} className="rounded bg-blue-600 px-4 py-2 text-white">
          Add 6 ft Table
        </button>

        <button onClick={addSquareTable} className="rounded bg-blue-600 px-4 py-2 text-white">
          Add 36&quot; Square Table
        </button>

        <button onClick={addRoundTable} className="rounded bg-blue-600 px-4 py-2 text-white">
          Add Round Table
        </button>

        <button onClick={addHighTopTable} className="rounded bg-blue-600 px-4 py-2 text-white">
          Add High Top
        </button>

        <button onClick={addChair} className="rounded bg-green-600 px-4 py-2 text-white">
          Add Chair
        </button>

        <div className="flex items-center gap-2 rounded border border-gray-300 bg-white p-2">
          <label className="text-sm text-black">Row chairs</label>
          <input
            type="number"
            min={1}
            value={rowChairCount}
            onChange={(e) => setRowChairCount(Number(e.target.value))}
            className="w-16 rounded border border-gray-400 bg-white text-black p-1"
          />
          <button onClick={addChairRow} className="rounded bg-green-700 px-3 py-2 text-white">
            Add Chair Row
          </button>
        </div>

        <div className="flex items-center gap-2 rounded border border-gray-300 bg-white p-2">
          <label className="text-sm text-black">Block</label>
          <input
            type="number"
            min={1}
            value={blockRows}
            onChange={(e) => setBlockRows(Number(e.target.value))}
            className="w-16 rounded border border-gray-400 bg-white text-black p-1"
          />
          <span className="text-black">x</span>
          <input
            type="number"
            min={1}
            value={blockCols}
            onChange={(e) => setBlockCols(Number(e.target.value))}
            className="w-16 rounded border border-gray-400 bg-white text-black p-1"
          />
          <button onClick={addChairBlock} className="rounded bg-emerald-700 px-3 py-2 text-white">
            Add Chair Block
          </button>
        </div>

        <button onClick={duplicateSelectedItem} className="rounded bg-cyan-700 px-4 py-2 text-white">
          Duplicate Selected
        </button>

        <button onClick={rotateSelectedItem} className="rounded bg-gray-700 px-4 py-2 text-white">
          Rotate Selected Item
        </button>

        <button onClick={deleteSelectedItem} className="rounded bg-red-600 px-4 py-2 text-white">
          Delete Selected Item
        </button>

        <button onClick={exportAsPdf} className="rounded bg-black px-4 py-2 text-white">
          Export PDF
        </button>
      </div>

      <div className="w-full max-w-6xl rounded border border-gray-300 bg-white p-3">
        <div className="mb-3 text-sm font-semibold">Layout Details</div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            placeholder="Layout name"
            className="rounded border border-gray-400 bg-white text-black p-2"
          />

          <input
            type="text"
            value={renterName}
            onChange={(e) => setRenterName(e.target.value)}
            placeholder="Renter name"
            className="rounded border border-gray-400 bg-white text-black p-2"
          />

          <input
            type="text"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="Event type"
            className="rounded border border-gray-400 bg-white text-black p-2"
          />

          <input
            type="text"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            placeholder="Expected guest count"
            className="rounded border border-gray-400 bg-white text-black p-2"
          />

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Setup notes"
            className="md:col-span-2 min-h-[90px] rounded border border-gray-400 bg-white text-black p-2"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button onClick={saveCurrentLayout} className="rounded bg-purple-600 px-4 py-2 text-white">
            Save Layout
          </button>

          <button onClick={updateSavedLayout} className="rounded bg-amber-600 px-4 py-2 text-white">
            Update Saved Layout
          </button>

          <select
            value={selectedSavedLayoutId}
            onChange={(e) => setSelectedSavedLayoutId(e.target.value)}
            className="w-64 rounded border border-gray-400 bg-white text-black p-2"
          >
            <option value="">Select saved layout</option>
            {savedLayouts.map((layout) => (
              <option key={layout.id} value={layout.id}>
                {layout.name} ({layout.selectedRoom})
              </option>
            ))}
          </select>

          <button onClick={loadSelectedLayout} className="rounded bg-indigo-600 px-4 py-2 text-white">
            Load
          </button>

          <button onClick={deleteSelectedLayout} className="rounded bg-rose-600 px-4 py-2 text-white">
            Delete Saved
          </button>
        </div>
      </div>

      <div className="w-full max-w-6xl rounded border border-gray-300 bg-white p-3">
        <div className="mb-2 text-sm font-semibold">Current Room Legend / Counts</div>

        <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
          <div>Rectangular Tables: {counts.rectTables}</div>
          <div>Square Tables: {counts.squareTables}</div>
          <div>Round Tables: {counts.roundTables}</div>
          <div>High Top Tables: {counts.highTopTables}</div>
          <div>Total Tables: {counts.totalTables}</div>
          <div>Attached Chairs on Tables: {counts.attachedChairsOnTables}</div>
          <div>Single Chairs: {counts.singleChairs}</div>
          <div>Chair Row Groups: {counts.chairRowGroups}</div>
          <div>Chairs in Rows: {counts.chairsInRows}</div>
          <div>Chair Block Groups: {counts.chairBlockGroups}</div>
          <div>Chairs in Blocks: {counts.chairsInBlocks}</div>
          <div className="font-semibold">Total Chairs: {counts.totalChairs}</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border">
        <Stage ref={stageRef} width={width} height={height}>
          <Layer>
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              fill="white"
              stroke="black"
              strokeWidth={2}
              onClick={clearSelection}
            />

            {Array.from({ length: Math.floor(width / gridSize) + 1 }).map((_, i) => (
              <Line
                key={`grid-v-${i}`}
                points={[i * gridSize, 0, i * gridSize, height]}
                stroke="#e5e7eb"
                strokeWidth={0.5}
                listening={false}
              />
            ))}

            {Array.from({ length: Math.floor(height / gridSize) + 1 }).map((_, i) => (
              <Line
                key={`grid-h-${i}`}
                points={[0, i * gridSize, width, i * gridSize]}
                stroke="#e5e7eb"
                strokeWidth={0.5}
                listening={false}
              />
            ))}

            {dividerMode !== "full" && (
              <Line
                points={[0, dividerY, width, dividerY]}
                stroke="black"
                strokeWidth={2}
                dash={[10, 5]}
              />
            )}

            {dividerMode === "top" && (
              <Rect
                x={0}
                y={dividerY}
                width={width}
                height={height - dividerY}
                fill="rgba(0,0,0,0.06)"
                listening={false}
              />
            )}

            {dividerMode === "bottom" && (
              <Rect
                x={0}
                y={0}
                width={width}
                height={dividerY}
                fill="rgba(0,0,0,0.06)"
                listening={false}
              />
            )}

            {selectedRoom === "accursi" && (
              <>
                <Text
                  x={8}
                  y={8}
                  text="Window side"
                  fontSize={14}
                  fontStyle="bold"
                  fill="black"
                  listening={false}
                />
                <Text
                  x={8}
                  y={height - 24}
                  text="B Side"
                  fontSize={14}
                  fontStyle="bold"
                  fill="black"
                  listening={false}
                />
              </>
            )}

            <Text
              x={8}
              y={height - 42}
              text="Scale: 1 ft = 10 px"
              fontSize={12}
              fill="black"
              listening={false}
            />

            {tables.map((table) => {
              const isSelected = selectedTableId === table.id;
              const displayNumber = getDisplayNumber(table.id);
              const centerLabel = getTableLabel(table.type);

              return (
                <Group
                  key={table.id}
                  x={table.x}
                  y={table.y}
                  rotation={table.rotation}
                  draggable
                  dragBoundFunc={(pos) => {
                    const clamped = clampTablePosition(table, pos.x, pos.y);
                    return { x: clamped.x, y: clamped.y };
                  }}
                  onClick={() => selectOnly("table", table.id)}
                  onTap={() => selectOnly("table", table.id)}
                  onDragEnd={(e) => {
                    const snapped = snapPoint(e.target.x(), e.target.y());
                    e.target.position(snapped);

                    const moved = updateTablePosition(table.id, snapped.x, snapped.y);

                    if (!moved) {
                      e.target.position({ x: table.x, y: table.y });
                    }
                  }}
                >
                  {getAttachedChairPositions(table).map((chair, index) => (
                    <Group
                      key={`attached-chair-${table.id}-${index}`}
                      x={chair.x}
                      y={chair.y}
                      rotation={chair.rotation}
                      listening={false}
                    >
                      <Rect
                        x={-(1.75 * scale) / 2}
                        y={-(1.5 * scale) / 2}
                        width={1.75 * scale}
                        height={1.5 * scale}
                        fill="#16a34a"
                        stroke="black"
                        strokeWidth={1}
                        cornerRadius={2}
                      />
                    </Group>
                  ))}

                  {table.type === "round" || table.type === "highTop" ? (
                    <Circle
                      x={0}
                      y={0}
                      radius={table.width / 2}
                      fill={getTableFillColor(table.type)}
                      stroke={isSelected ? "orange" : "black"}
                      strokeWidth={isSelected ? 3 : 1}
                    />
                  ) : (
                    <Rect
                      x={-table.width / 2}
                      y={-table.height / 2}
                      width={table.width}
                      height={table.height}
                      fill={getTableFillColor(table.type)}
                      stroke={isSelected ? "orange" : "black"}
                      strokeWidth={isSelected ? 3 : 1}
                    />
                  )}

                  <Text
                    x={-table.width / 2}
                    y={-8}
                    width={table.width}
                    text={String(displayNumber)}
                    align="center"
                    fontSize={16}
                    fontStyle="bold"
                    fill="white"
                    listening={false}
                  />

                  {centerLabel !== "" && (
                    <Text
                      x={-table.width / 2}
                      y={4}
                      width={table.width}
                      text={centerLabel}
                      align="center"
                      fontSize={12}
                      fontStyle="bold"
                      fill="white"
                      listening={false}
                    />
                  )}
                </Group>
              );
            })}

            {chairs.map((chair) => {
              const isSelected = selectedChairId === chair.id;

              return (
                <Group
                  key={chair.id}
                  x={chair.x}
                  y={chair.y}
                  rotation={chair.rotation}
                  draggable
                  dragBoundFunc={(pos) => {
                    const clamped = clampChairPosition(chair, pos.x, pos.y);
                    return { x: clamped.x, y: clamped.y };
                  }}
                  onClick={() => selectOnly("chair", chair.id)}
                  onTap={() => selectOnly("chair", chair.id)}
                  onDragEnd={(e) => {
                    const snapped = snapPoint(e.target.x(), e.target.y());
                    e.target.position(snapped);

                    const moved = updateChairPosition(chair.id, snapped.x, snapped.y);

                    if (!moved) {
                      e.target.position({ x: chair.x, y: chair.y });
                    }
                  }}
                >
                  <Rect
                    x={-chair.width / 2}
                    y={-chair.height / 2}
                    width={chair.width}
                    height={chair.height}
                    fill="#16a34a"
                    stroke={isSelected ? "orange" : "black"}
                    strokeWidth={isSelected ? 3 : 1}
                    cornerRadius={2}
                  />
                </Group>
              );
            })}

            {chairRows.map((row) => {
              const isSelected = selectedChairRowId === row.id;
              const totalWidth =
                row.chairCount * row.chairWidth +
                (row.chairCount - 1) * row.spacing;

              return (
                <Group
                  key={row.id}
                  x={row.x}
                  y={row.y}
                  rotation={row.rotation}
                  draggable
                  dragBoundFunc={(pos) => {
                    const clamped = clampChairRowPosition(row, pos.x, pos.y);
                    return { x: clamped.x, y: clamped.y };
                  }}
                  onClick={() => selectOnly("chairRow", row.id)}
                  onTap={() => selectOnly("chairRow", row.id)}
                  onDragEnd={(e) => {
                    const snapped = snapPoint(e.target.x(), e.target.y());
                    e.target.position(snapped);

                    const moved = updateChairRowPosition(row.id, snapped.x, snapped.y);

                    if (!moved) {
                      e.target.position({ x: row.x, y: row.y });
                    }
                  }}
                >
                  {Array.from({ length: row.chairCount }).map((_, index) => {
                    const chairX =
                      -totalWidth / 2 +
                      row.chairWidth / 2 +
                      index * (row.chairWidth + row.spacing);

                    return (
                      <Rect
                        key={index}
                        x={chairX - row.chairWidth / 2}
                        y={-row.chairHeight / 2}
                        width={row.chairWidth}
                        height={row.chairHeight}
                        fill="#16a34a"
                        stroke={isSelected ? "orange" : "black"}
                        strokeWidth={isSelected ? 2 : 1}
                        cornerRadius={2}
                      />
                    );
                  })}
                </Group>
              );
            })}

            {chairBlocks.map((block) => {
              const isSelected = selectedChairBlockId === block.id;
              const totalWidth =
                block.cols * block.chairWidth +
                (block.cols - 1) * block.colSpacing;
              const totalHeight =
                block.rows * block.chairHeight +
                (block.rows - 1) * block.rowSpacing;

              return (
                <Group
                  key={block.id}
                  x={block.x}
                  y={block.y}
                  rotation={block.rotation}
                  draggable
                  dragBoundFunc={(pos) => {
                    const clamped = clampChairBlockPosition(block, pos.x, pos.y);
                    return { x: clamped.x, y: clamped.y };
                  }}
                  onClick={() => selectOnly("chairBlock", block.id)}
                  onTap={() => selectOnly("chairBlock", block.id)}
                  onDragEnd={(e) => {
                    const snapped = snapPoint(e.target.x(), e.target.y());
                    e.target.position(snapped);

                    const moved = updateChairBlockPosition(block.id, snapped.x, snapped.y);

                    if (!moved) {
                      e.target.position({ x: block.x, y: block.y });
                    }
                  }}
                >
                  {Array.from({ length: block.rows }).map((_, rowIndex) =>
                    Array.from({ length: block.cols }).map((__, colIndex) => {
                      const chairX =
                        -totalWidth / 2 +
                        block.chairWidth / 2 +
                        colIndex * (block.chairWidth + block.colSpacing);

                      const chairY =
                        -totalHeight / 2 +
                        block.chairHeight / 2 +
                        rowIndex * (block.chairHeight + block.rowSpacing);

                      return (
                        <Rect
                          key={`${rowIndex}-${colIndex}`}
                          x={chairX - block.chairWidth / 2}
                          y={chairY - block.chairHeight / 2}
                          width={block.chairWidth}
                          height={block.chairHeight}
                          fill="#16a34a"
                          stroke={isSelected ? "orange" : "black"}
                          strokeWidth={isSelected ? 2 : 1}
                          cornerRadius={2}
                        />
                      );
                    })
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
