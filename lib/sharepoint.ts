import { getToken } from "@microsoft/teams-js"

interface SharePointConfig {
  siteUrl: string
  listName: string
}

class SharePointClient {
  private siteUrl: string
  private listName: string

  constructor(config: SharePointConfig) {
    this.siteUrl = config.siteUrl
    this.listName = config.listName
  }

  private async getAuthToken(): Promise<string> {
    try {
      const token = await getToken()
      return token
    } catch (error) {
      console.error("Error getting auth token:", error)
      throw new Error("Failed to get authentication token")
    }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = await this.getAuthToken()
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      throw new Error(`SharePoint API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getUsers() {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('${this.listName}')/items?$select=Id,Title,Role`
    return this.fetchWithAuth(url)
  }

  async authenticateUser(username: string, password: string) {
    // This is a placeholder - you'll need to implement actual SharePoint authentication
    // You might want to use Microsoft Graph API or SharePoint REST API for this
    const users = await this.getUsers()
    const user = users.find((u: any) => u.Title === username)
    
    if (!user) {
      throw new Error("User not found")
    }

    // In a real implementation, you would verify the password against SharePoint
    // For now, we'll just return the user if found
    return {
      id: user.Id,
      username: user.Title,
      role: user.Role,
    }
  }

  async getBuildings() {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('Buildings')/items`
    return this.fetchWithAuth(url)
  }

  async getRooms() {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('Rooms')/items`
    return this.fetchWithAuth(url)
  }

  async getTasks() {
    const url = `${this.siteUrl}/_api/web/lists/getbytitle('Tasks')/items`
    return this.fetchWithAuth(url)
  }
}

// Initialize SharePoint client with your site configuration
export const sharepoint = new SharePointClient({
  siteUrl: process.env.SHAREPOINT_SITE_URL || "",
  listName: "Users",
}) 