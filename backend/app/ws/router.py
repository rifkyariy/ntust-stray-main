from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            # Keep connection alive; we only push from server side
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
