export const preferredBlockOrder = ["NATHNAGAR BLOCK", "JAGDISHPUR", "SABOUR"];

export const configuredBlockPanchayats = {
  "NATHNAGAR BLOCK": [
    "Belkhoriya",
    "Bhatoriya",
    "Bhuwalpur",
    "Gaurachauki",
    "Kajraili",
    "Nisfambai",
    "Nurpur",
    "Raghopur",
    "Rampur Khurd",
    "Rattipur Bairiya",
    "Vishanrampur",
  ],
  JAGDISHPUR: [
    "Baijani",
    "Baluachak Puraini",
    "Bhawanipur Desari",
    "Chandpur",
    "Habibpur",
    "Imampur",
    "Jagdishpur",
    "Jamni",
    "Khiribandh",
    "Puraini Dakshini",
    "Puraini Tola Sonuchak",
    "Puraini Uttari",
    "Saino",
    "Sanhauli",
    "Shahjangi",
  ],
  SABOUR: [
    "Baijalpur",
    "Barari",
    "Chandheri",
    "Farka",
    "Fatehpur",
    "Khankita",
    "Lailakh",
    "Lodipur",
    "Mamalkha",
    "Parghari",
    "Rajandipur",
    "Sabour",
    "Sardho",
    "Shankarur-Diyara",
  ],
};

export function getBlockDisplayName(block, parent) {
  const childName = block.name.toLocaleUpperCase();
  const parentName = parent?.name.toLocaleUpperCase();
  const parentBaseName = parentName?.replace(/\s+BLOCK$/, "");
  return parentBaseName === childName ? parent.name : block.name;
}

export function sortBlocks(blocks, parentsById) {
  return [...blocks].sort((left, right) => {
    const leftName = getBlockDisplayName(left, parentsById.get(left.parent_id)).toLocaleUpperCase();
    const rightName = getBlockDisplayName(right, parentsById.get(right.parent_id)).toLocaleUpperCase();
    const leftIndex = preferredBlockOrder.indexOf(leftName);
    const rightIndex = preferredBlockOrder.indexOf(rightName);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
        - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }
    return leftName.localeCompare(rightName);
  });
}
