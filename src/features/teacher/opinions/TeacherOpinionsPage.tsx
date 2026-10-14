import PageShell from "../../../shared/PageShell.tsx";
import StudentOpinionsPanel from "../student-opinions/StudentOpinionsPanel.tsx";

export default function TeacherOpinionsPage({ roomId }: { readonly roomId: string }) {
  return <PageShell title="학생 의견" roomId={roomId}>
    <StudentOpinionsPanel roomId={roomId} />
  </PageShell>;
}
