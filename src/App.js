import React, { useEffect, useReducer, useCallback } from "react";
import { generateClient } from "aws-amplify/api";
import { v4 as uuid } from "uuid";
import { List, Input, Button } from "antd";
import "antd/dist/reset.css";
import { DeleteOutlined } from "@ant-design/icons";
import { listNotes } from "./graphql/queries";
import {
   createNote as CreateNote,
   deleteNote as DeleteNote,
   updateNote as UpdateNote,
} from "./graphql/mutations";
import {
   onCreateNote,
   onDeleteNote,
   onUpdateNote,
} from "./graphql/subscriptions";
import "./App.css";

const CLIENT_ID = uuid();

const initialState = {
   notes: [],
   loading: true,
   error: false,
   form: { name: "", description: "" },
};

function reducer(state, action) {
   switch (action.type) {
      case "SET_NOTES":
         return { ...state, notes: action.notes, loading: false };
      case "ADD_NOTE":
         return { ...state, notes: [action.note, ...state.notes] };
      case "DELETE_NOTE":
         return {
            ...state,
            notes: state.notes.filter((note) => note.id !== action.note.id),
         };
      case "UPDATE_NOTE":
         return {
            ...state,
            notes: state.notes.map((note) =>
               note.id === action.note.id ? action.note : note,
            ),
         };
      case "RESET_FORM":
         return { ...state, form: initialState.form };
      case "SET_INPUT":
         return {
            ...state,
            form: { ...state.form, [action.name]: action.value },
         };
      case "ERROR":
         return { ...state, loading: false, error: true };
      default:
         return { ...state };
   }
}

const App = () => {
   const [state, dispatch] = useReducer(reducer, initialState);

   const client = generateClient();

   const fetchNotes = useCallback(async () => {
      try {
         const notesData = await client.graphql({
            query: listNotes,
         });
         dispatch({
            type: "SET_NOTES",
            notes: notesData.data.listNotes.items,
         });
      } catch (err) {
         console.error(err);
         dispatch({ type: "ERROR" });
      }
   }, [client]);

   const createNote = async () => {
      const { form } = state;

      if (!form.name || !form.description) {
         return alert("A name and description are required.");
      }

      const note = {
         ...form,
         clientId: CLIENT_ID,
         completed: false,
         id: uuid(),
      };

      dispatch({ type: "ADD_NOTE", note });
      dispatch({ type: "RESET_FORM" });

      try {
         await client.graphql({
            query: CreateNote,
            variables: { input: note },
         });
      } catch (err) {
         console.error(err);
      }
   };

   const onChange = (e) => {
      dispatch({
         type: "SET_INPUT",
         name: e.target.name,
         value: e.target.value,
      });
   };

   const deleteNote = async ({ id }) => {
      const index = state.notes.findIndex((n) => n.id === id);
      const notes = [
         ...state.notes.slice(0, index),
         ...state.notes.slice(index + 1),
      ];

      dispatch({ type: "SET_NOTES", notes });

      try {
         await client.graphql({
            query: DeleteNote,
            variables: { input: { id } },
         });
      } catch (err) {
         console.error(err);
      }
   };

   const updateNote = async (note) => {
      const index = state.notes.findIndex((n) => n.id === note.id);
      const notes = [...state.notes];
      notes[index].completed = !note.completed;
      dispatch({ type: "SET_NOTES", notes });

      try {
         await client.graphql({
            query: UpdateNote,
            variables: {
               input: { id: note.id, completed: notes[index].completed },
            },
         });
      } catch (err) {
         console.error(err);
      }
   };

   useEffect(() => {
      fetchNotes();

      const onCreateSubscription = client
         .graphql({
            query: onCreateNote,
         })
         .subscribe({
            next: (noteData) => {
               console.log(noteData);
               const note = noteData.data.onCreateNote;
               if (CLIENT_ID === note.clientId) return;
               dispatch({ type: "ADD_NOTE", note });
            },
         });

      const onDeleteSubscription = client
         .graphql({
            query: onDeleteNote,
         })
         .subscribe({
            next: (noteData) => {
               console.log(noteData);
               const note = noteData.data.onDeleteNote;
               if (CLIENT_ID === note.clientId) return;
               dispatch({ type: "DELETE_NOTE", note });
            },
         });

      const onUpdateSubscription = client
         .graphql({
            query: onUpdateNote,
         })
         .subscribe({
            next: (noteData) => {
               console.log(noteData);
               const note = noteData.data.onUpdateNote;
               if (CLIENT_ID === note.clientId) return;
               dispatch({ type: "UPDATE_NOTE", note });
            },
         });

      return () => {
         onCreateSubscription.unsubscribe();
         onDeleteSubscription.unsubscribe();
         onUpdateSubscription.unsubscribe();
      };
   }, [client, fetchNotes]);

   function renderItem(item) {
      return (
         <List.Item
            actions={[
               <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => updateNote(item)}
               />,
               <DeleteOutlined onClick={() => deleteNote(item)} />,
            ]}
         >
            <List.Item.Meta title={item.name} description={item.description} />
         </List.Item>
      );
   }

   return (
      <div className="App">
         <Input
            onChange={onChange}
            value={state.form.name}
            placeholder="Note name"
            name="name"
         />
         <Input
            onChange={onChange}
            value={state.form.description}
            placeholder="Note description"
            name="description"
         />
         <Button onClick={createNote} type="primary">
            Create Note
         </Button>

         <List
            loading={state.loading}
            dataSource={state.notes}
            renderItem={renderItem}
            className="list"
         />
      </div>
   );
};

export default App;
