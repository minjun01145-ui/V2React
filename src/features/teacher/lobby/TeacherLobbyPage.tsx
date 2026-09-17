import TeacherBgm from "../bgm/TeacherBgm.tsx";
import TeacherRoomController from "../room-control/TeacherRoomController.tsx";

export default function TeacherLobbyPage({ roomId }: { readonly roomId: string }) {
  return <>
    <TeacherBgm roomId={roomId} />
    <TeacherRoomController roomId={roomId} />
  </>;
}
