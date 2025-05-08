"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { Download, Trash2, Eye } from "lucide-react"
import { toast } from "sonner"

interface CleaningSheet {
  id: string
  name: string
  type: string
  url: string
  createdAt: string
  room: {
    name: string
    building: string
    floor: string
  }
}

export default function CleaningSheetsPage() {
  const [sheets, setSheets] = useState<CleaningSheet[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchSheets()
  }, [])

  const fetchSheets = async () => {
    try {
      const response = await fetch("/api/cleaning-sheets")
      if (!response.ok) throw new Error("Failed to fetch cleaning sheets")
      const data = await response.json()
      setSheets(data)
    } catch (error) {
      toast.error("Failed to load cleaning sheets")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this cleaning sheet?")) return
    
    try {
      const response = await fetch(`/api/cleaning-sheets/${id}`, {
        method: "DELETE",
      })
      
      if (!response.ok) throw new Error("Failed to delete cleaning sheet")
      
      toast.success("Cleaning sheet deleted successfully")
      fetchSheets()
    } catch (error) {
      toast.error("Failed to delete cleaning sheet")
    }
  }

  const handleDownload = (url: string, name: string) => {
    window.open(url, "_blank")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Cleaning Sheets</h1>
        <Button onClick={() => router.push("/cleaning-sheets/upload")}>
          Upload New Sheet
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cleaning Sheets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Building</TableHead>
                <TableHead>Floor</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheets.map((sheet) => (
                <TableRow key={sheet.id}>
                  <TableCell>{sheet.name}</TableCell>
                  <TableCell>{sheet.room.name}</TableCell>
                  <TableCell>{sheet.room.building}</TableCell>
                  <TableCell>{sheet.room.floor}</TableCell>
                  <TableCell>{format(new Date(sheet.createdAt), "PPp")}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(sheet.url, sheet.name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.push(`/cleaning-sheets/${sheet.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(sheet.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 