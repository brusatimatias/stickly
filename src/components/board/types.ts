export type NoteDTO = {
  id: string;
  title: string;
  location: string | null;
  time: string; // HH:mm
  googleEventId: string | null;
};

export type BoardDay = {
  key: string; // yyyy-MM-dd
  label: string;
};
