export type NoteDTO = {
  id: string;
  title: string;
  location: string | null;
  time: string; // HH:mm
};

export type BoardDay = {
  key: string; // yyyy-MM-dd
  label: string;
};
