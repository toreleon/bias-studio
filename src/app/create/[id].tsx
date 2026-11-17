import React from "react";
import { useLocalSearchParams } from "expo-router";
import { CreateScreen } from "../../screens/CreateScreen";
export default function CreateRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CreateScreen key={id} />;
}
