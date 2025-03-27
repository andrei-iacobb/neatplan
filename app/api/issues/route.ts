import { NextResponse } from  "next/server"
import { db } from "@/lib/db"
import { verifyAuth } from "@/lib/auth"
import { ACTION_HMR_REFRESH } from "next/dist/client/components/router-reducer/router-reducer-types"

export async function GET(request: Request){
    try{
     // verify auth
        const authResult = await verifyAuth(request)
        if (!authResult.isAuthenticated){
            return NextResponse.json({error: "Unauthorised"}, { status: 401})
        }

        const {searchParams } = new URL(request.url)
        const status = searchParams.get("status")

        let query = "SELECT t.*, h.name as assigned_to_name FROM tasks t LEFT JOIN housekeepers h ON t.assigned_to = h.id"
        const queryParams = []

        if (status) {
            query += "WHERE t.status = $1"
            queryParams.push(status)
        }

        query += " ORDER BY t.created_at DESC "

        const result = await db.query(query, queryParams)

        return NextResponse.json(result.rows)
    } catch (error){
        console.error("Error fetching tasks:", error)
        return NextResponse.json({error: "internal server error"}, {status: 500})
    }
}

export async function POST(request:Request) {
    try{
        const authResult = await verifyAuth(request)
        if (!authResult.isAuthenticated){
            return NextResponse.json({error: "Unauthorised"}, {status: 401})
        }
        const { title, description, status, assigned_to, scheduled_for} = await
        request.json()

        if(!title){
            return NextResponse.json({error: "title is required"}, {status: 400})
        }
        const result =  await db.query(
            `INSERT INTO tasks (title, description, status, assigned_to, scheduled_for) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING *, 
             (SELECT name FROM housekeepers WHERE id = $4) as assigned_to_name`,
             [title, description, status || "scheduled", assigned_to, scheduled_for]
        )
        return NextResponse.json(result.rows[0])
    }catch (error){
        console.error("Error creating tasks", error)
        return NextResponse.json({error: "internal serer error "})
    }
}