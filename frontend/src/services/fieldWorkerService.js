import { adminRequest } from "./adminDataService";

export async function loadWorkspaceRecords(accessToken) {
  const [blocks, panchayats, booths, voters] = await Promise.all([
    adminRequest("/workspace/blocks", accessToken),
    adminRequest("/workspace/panchayats", accessToken),
    adminRequest("/workspace/booths", accessToken),
    adminRequest("/workspace/voters", accessToken),
  ]);

  return { blocks, panchayats, booths, voters };
}
