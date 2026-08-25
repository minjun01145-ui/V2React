import TeacherRoomController from "../room-control/TeacherRoomController.tsx";

export default function TeacherLobbyPage({ roomId }: { readonly roomId: string }) {
  return <TeacherRoomController roomId={roomId} />;
}
