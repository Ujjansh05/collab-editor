// Bring in React hooks we need - useState for tracking state, useEffect for side effects, useRef for persistent values
import React, { useState, useEffect, useRef } from 'react';
// Get all our UI icons from lucide-react
import { FileText, Users, Plus, Trash2, Edit3, FileCode, Download, Copy, Check, Share2, Moon, Sun } from 'lucide-react';
// Pull in the Firebase database we set up
import { database } from './firebase';
// Import the Firebase functions we'll use to read and write data
import { ref, onValue, set, push, remove, update } from 'firebase/database';

function App() {
  // All our state variables - these keep track of what's happening in the app
  const [documents, setDocuments] = useState([]); // holds all the documents from Firebase
  const [activeDocId, setActiveDocId] = useState(null); // which document we're looking at right now
  const [content, setContent] = useState(''); // the actual text in the editor
  const [users, setUsers] = useState([]); // who else is editing this document
  const [userName, setUserName] = useState(''); // what we call ourselves
  const [userId, setUserId] = useState(''); // our unique ID
  const [isEditingName, setIsEditingName] = useState(false); // true when someone's changing their name
  const [copied, setCopied] = useState(false); // for showing the "copied!" message
  const [showNewDocModal, setShowNewDocModal] = useState(false); // controls the new file popup
  const [newDocName, setNewDocName] = useState(''); // name being typed for a new document
  const [newDocType, setNewDocType] = useState('text'); // what kind of file to create
  const [isLoading, setIsLoading] = useState(true); // true until we finish loading data
  const [shareLink, setShareLink] = useState(''); // stores the share link temporarily
  const [darkMode, setDarkMode] = useState(false); // whether dark mode is on
  
  // These refs don't trigger re-renders, just hold values we need
  const textareaRef = useRef(null); // gives us direct access to the textarea element
  const isUpdatingFromFirebase = useRef(false); // helps us avoid endless update loops

  // Starter templates - when someone creates a new file, we give them this boilerplate
  const fileTemplates = {
    javascript: '// JavaScript File\n\nfunction main() {\n  console.log("Hello, World!");\n}\n\nmain();',
    python: '# Python File\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()',
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>',
    css: '/* CSS Stylesheet */\n\nbody {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n  background: #f5f5f5;\n}\n\nh1 {\n  color: #333;\n}',
    json: '{\n  "name": "project",\n  "version": "1.0.0",\n  "description": "Project description"\n}',
    markdown: '# Document Title\n\n## Introduction\n\nStart writing your markdown content here...',
    text: ''
  };

  // Maps file types to their extensions
  const fileExtensions = {
    javascript: '.js',
    python: '.py',
    html: '.html',
    css: '.css',
    json: '.json',
    markdown: '.md',
    text: '.txt'
  };

  // Colors we randomly assign to users so you can tell who's who
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // When the app first loads, give this person a random ID and username
  useEffect(() => {
    // Make a random ID by converting a number to base-36
    const id = 'user_' + Math.random().toString(36).substr(2, 9);
    setUserId(id);
    // Turn the last few characters into a readable username
    const name = 'User_' + id.substr(-4);
    setUserName(name);
  }, []); // runs just once when the component mounts

  // Listen for any changes to the documents list in Firebase
  useEffect(() => {
    // Point to the documents collection
    const docsRef = ref(database, 'documents');
    // This callback fires whenever documents change
    const unsubscribe = onValue(docsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Firebase gives us an object, turn it into an array we can loop through
        const docsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setDocuments(docsList);
        // Auto-select the first document if nothing's selected yet
        if (!activeDocId && docsList.length > 0) {
          setActiveDocId(docsList[0].id);
        }
      } else {
        // Database is empty, so create some sample files
        createInitialDocuments();
      }
      setIsLoading(false); // we're done loading now
    });

    // Clean up the listener when this component disappears
    return () => unsubscribe();
  }, []); // only runs once on startup

  // Creates a couple starter files when the database is empty
  const createInitialDocuments = async () => {
    // A markdown file to get started
    const doc1 = {
      name: 'Project Proposal.md',
      content: '# Project Proposal\n\nStart writing your project proposal here...',
      type: 'markdown',
      lastEdited: Date.now()
    };
    // And a JavaScript file
    const doc2 = {
      name: 'app.js',
      content: '// JavaScript Code\nconst greeting = "Hello, World!";\nconsole.log(greeting);',
      type: 'javascript',
      lastEdited: Date.now()
    };

    // Get Firebase to generate unique IDs for these
    const docsRef = ref(database, 'documents');
    const newDoc1Ref = push(docsRef);
    const newDoc2Ref = push(docsRef);
    
    // Save them to the database
    await set(newDoc1Ref, doc1);
    await set(newDoc2Ref, doc2);
  };

  // Watch the current document for any changes (like when someone else types)
  useEffect(() => {
    // Bail out if we don't have a document selected
    if (!activeDocId) return;

    // Point to this specific document
    const docRef = ref(database, `documents/${activeDocId}`);
    // Get notified whenever it changes
    const unsubscribe = onValue(docRef, (snapshot) => {
      const data = snapshot.val();
      // Make sure there's actually content before updating
      if (data && data.content !== undefined) {
        // Flag this so we don't accidentally sync it back to Firebase
        isUpdatingFromFirebase.current = true;
        setContent(data.content); // update what's shown in the editor
        // Turn the flag off after a moment
        setTimeout(() => {
          isUpdatingFromFirebase.current = false;
        }, 100);
      }
    });

    // Stop listening when we switch documents or close the app
    return () => unsubscribe();
  }, [activeDocId]); // runs again whenever we switch documents

  // Handle joining/leaving documents and keeping track of who's here
  useEffect(() => {
    // Wait until we have both a document and user ID
    if (!activeDocId || !userId) return;

    // Add ourselves to this document's user list
    const userRef = ref(database, `users/${activeDocId}/${userId}`);
    set(userRef, {
      name: userName,
      color: colors[Math.floor(Math.random() * colors.length)], // pick a random color
      typing: false,
      lastActive: Date.now() // so we know when we last did something
    });

    // Watch the full list of users on this document
    const usersRef = ref(database, `users/${activeDocId}`);
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const now = Date.now();
        const activeThreshold = 30000; // 30 seconds without activity = inactive
        
        // Filter out anyone who hasn't been active recently
        const usersList = Object.keys(data)
          .map(key => ({
            id: key,
            ...data[key]
          }))
          .filter(user => {
            const isActive = (now - user.lastActive) < activeThreshold;
            // Clean up inactive users (but not ourselves)
            if (!isActive && user.id !== userId) {
              remove(ref(database, `users/${activeDocId}/${user.id}`));
            }
            return isActive; // only show active users
          });
        
        setUsers(usersList); // update the user list in the UI
      }
    });

    // Ping Firebase every 10 seconds to show we're still here
    const keepAliveInterval = setInterval(() => {
      update(userRef, {
        lastActive: Date.now()
      });
    }, 10000);

    // Clean up when we leave this document
    return () => {
      remove(userRef); // take ourselves out of the list
      unsubscribe(); // stop listening
      clearInterval(keepAliveInterval); // stop the pings
    };
  }, [activeDocId, userId, userName]); // runs again if any of these change

  // Holds the timer for hiding the typing indicator
  const typingTimeoutRef = useRef(null);
  
  // Fires every time someone types in the editor
  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent); // show it in the editor right away

    // Don't send to Firebase if this update came FROM Firebase (prevents infinite loop)
    if (isUpdatingFromFirebase.current) return;

    // Send the new content to Firebase so everyone sees it
    const docRef = ref(database, `documents/${activeDocId}`);
    update(docRef, {
      content: newContent,
      lastEdited: Date.now() // track when this was last changed
    });

    // Show the "typing..." indicator for this user
    const userRef = ref(database, `users/${activeDocId}/${userId}`);
    set(userRef, {
      name: userName,
      color: users.find(u => u.id === userId)?.color || colors[0],
      typing: true, // turn on the typing indicator
      lastActive: Date.now()
    });

    // Cancel any previous timer
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    // After 1 second of no typing, hide the indicator
    typingTimeoutRef.current = setTimeout(() => {
      set(userRef, {
        name: userName,
        color: users.find(u => u.id === userId)?.color || colors[0],
        typing: false, // turn it off
        lastActive: Date.now()
      });
    }, 1000);
  };

  // Opens the popup for creating a new file
  const createNewDocument = () => {
    setShowNewDocModal(true);
    setNewDocName(''); // start with a blank name
    setNewDocType('text'); // default to text file
  };

  // Actually creates the file once they click "Create"
  const confirmCreateDocument = async () => {
    // Don't create if they didn't enter a name
    if (!newDocName.trim()) return;
    
    // Add the right extension if they didn't include one
    const extension = fileExtensions[newDocType];
    const fullName = newDocName.includes('.') ? newDocName : newDocName + extension;
    
    // Build the new document with starter code
    const newDoc = {
      name: fullName,
      content: fileTemplates[newDocType], // grab the template for this file type
      type: newDocType,
      lastEdited: Date.now()
    };

    // Let Firebase generate a unique ID and save it
    const docsRef = ref(database, 'documents');
    const newDocRef = push(docsRef);
    await set(newDocRef, newDoc);
    setActiveDocId(newDocRef.key); // jump to the new document
    setShowNewDocModal(false); // close the popup
  };

  // Delete a document (but not the last one!)
  const deleteDocument = async (docId) => {
    // Don't let them delete everything
    if (documents.length === 1) return;
    
    // Remove it from Firebase
    const docRef = ref(database, `documents/${docId}`);
    await remove(docRef);
    
    // If we just deleted what we were looking at, switch to something else
    if (activeDocId === docId) {
      const remaining = documents.filter(d => d.id !== docId);
      if (remaining.length > 0) {
        setActiveDocId(remaining[0].id); // open the first remaining doc
      }
    }
  };

  // Change a document's name
  const renameDocument = async (docId, newName) => {
    const docRef = ref(database, `documents/${docId}`);
    await update(docRef, { name: newName }); // just update the name field
  };

  // Download the current document to their computer
  const downloadDocument = () => {
    const doc = documents.find(d => d.id === activeDocId);
    if (!doc) return;

    // Turn the content into a downloadable file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name; // use the document's name
    a.click(); // start the download
    URL.revokeObjectURL(url); // clean up
  };

  // Copy the document text to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true); // show the checkmark
    setTimeout(() => setCopied(false), 2000); // hide it after 2 seconds
  };

  // Generate a shareable link and copy it
  const shareDocument = () => {
    // Make a URL with the document ID in it
    const url = `${window.location.origin}${window.location.pathname}?doc=${activeDocId}`;
    navigator.clipboard.writeText(url); // copy it
    setShareLink(url); // show the "copied!" message
    setTimeout(() => setShareLink(''), 3000); // hide it after 3 seconds
  };

  // Check if someone opened a shared link
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docId = params.get('doc'); // look for ?doc=something in the URL
    // If it's a real document, open it
    if (docId && documents.some(d => d.id === docId)) {
      setActiveDocId(docId);
    }
  }, [documents]); // check again when documents load

  // Update someone's username
  const updateUserName = async (newName) => {
    setUserName(newName); // change it locally
    // also update it in Firebase if we're in a document
    if (activeDocId && userId) {
      const userRef = ref(database, `users/${activeDocId}/${userId}`);
      await update(userRef, { name: newName });
    }
  };

  // Quick lookups we use in multiple places
  const activeDoc = documents.find(d => d.id === activeDocId); // the doc we're viewing
  const isCodeFile = activeDoc?.type !== 'text' && activeDoc?.type !== 'markdown'; // is it code?

  // Load dark mode setting from last time
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      setDarkMode(savedMode === 'true'); // turn it into a boolean
    }
  }, []); // just once on startup

  // Switch between light and dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode); // flip it
    localStorage.setItem('darkMode', newMode.toString()); // remember it
  };

  // Show a loading spinner while we're fetching stuff from Firebase
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center">
          {/* spinning circle */}
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Loading CollabEdit...</p>
        </div>
      </div>
    );
  }

  // Here's the actual app interface
  return (
    <div className={`flex h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Green banner at the top showing we're connected */}
      <div className={`fixed top-0 left-0 right-0 ${darkMode ? 'bg-green-900 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700'} border-b px-6 py-2 text-sm z-50 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="font-medium">🔥 Live Collaboration Active</span>
          <span className={darkMode ? 'text-green-400' : 'text-green-600'}>• Share this page with others to edit together!</span>
        </div>
        <div className="flex items-center gap-3">
          {shareLink && (
            <span className={`font-medium ${darkMode ? 'text-green-400' : 'text-green-600'}`}>✓ Share link copied!</span>
          )}
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* New Document Modal */}
      {showNewDocModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg p-6 w-96 shadow-xl`}>
            <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>Create New File</h2>
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>File Name</label>
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmCreateDocument()}
                placeholder="Enter file name"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : 'border-gray-300 text-gray-900'}`}
                autoFocus
              />
            </div>
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>File Type</label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'border-gray-300 text-gray-900'}`}
              >
                <option value="text">Text (.txt)</option>
                <option value="markdown">Markdown (.md)</option>
                <option value="javascript">JavaScript (.js)</option>
                <option value="python">Python (.py)</option>
                <option value="html">HTML (.html)</option>
                <option value="css">CSS (.css)</option>
                <option value="json">JSON (.json)</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={confirmCreateDocument}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewDocModal(false)}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`w-64 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-r flex flex-col mt-10`}>
        <div className={`p-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <Edit3 className="text-blue-600" size={24} />
            <h1 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>CollabEdit</h1>
          </div>
          <button
            onClick={createNewDocument}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            New File
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <h2 className={`text-xs font-semibold uppercase px-2 mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Files</h2>
          {documents.map(doc => {
            const isCode = doc.type !== 'text' && doc.type !== 'markdown';
            return (
              <div
                key={doc.id}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors ${
                  activeDocId === doc.id
                    ? darkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-50 text-blue-700'
                    : darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => setActiveDocId(doc.id)}
              >
                {isCode ? <FileCode size={16} /> : <FileText size={16} />}
                <span className="flex-1 text-sm truncate">{doc.name}</span>
                {documents.length > 1 && (
                    <button
                    onClick={(e) => {
                      e.stopPropaga
                      tion();
                      deleteDocument(doc.id);
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${darkMode ? 'hover:bg-red-900' : 'hover:bg-red-100'}`}
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className={`p-4 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Users size={16} className={darkMode ? 'text-gray-400' : 'text-gray-500'} />
            <span className={`text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Active Users ({users.length})
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full relative flex-shrink-0"
                  style={{ backgroundColor: user.color }}
                >
                  {user.typing && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
                {user.id === userId && isEditingName ? (
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onBlur={() => {
                      setIsEditingName(false);
                      updateUserName(userName);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setIsEditingName(false);
                        updateUserName(userName);
                      }
                    }}
                    className={`text-sm flex-1 px-2 py-1 border border-blue-300 rounded ${darkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-900'}`}
                    autoFocus
                  />
                ) : (
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm cursor-pointer truncate block ${darkMode ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'}`}
                      onClick={() => user.id === userId && setIsEditingName(true)}
                    >
                      {user.name} {user.id === userId && '(you)'}
                    </span>
                    {user.typing && (
                      <span className={`text-xs ${darkMode ? 'text-green-400' : 'text-green-600'}`}>typing...</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col mt-10">
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-6 py-4 flex items-center justify-between`}>
          <div className="flex-1">
            <input
              type="text"
              value={activeDoc?.name || ''}
              onChange={(e) => renameDocument(activeDocId, e.target.value)}
              className={`text-2xl font-semibold bg-transparent border-none outline-none focus:text-blue-600 w-full ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}
            />
            <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Last edited: {activeDoc?.lastEdited ? new Date(activeDoc.lastEdited).toLocaleTimeString() : 'Never'}
              {isCodeFile && <span className={`ml-3 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>• Code File</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={shareDocument}
              className="flex items-center gap-2 px-4 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              title="Share document"
            >
              <Share2 size={18} />
              Share
            </button>
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}`}
              title="Copy to clipboard"
            >
              {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={downloadDocument}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Download file"
            >
              <Download size={18} />
              Download
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className={`flex-1 p-6 overflow-y-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
          <div className="max-w-5xl mx-auto">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              className={`w-full h-full min-h-[600px] p-6 leading-relaxed resize-none focus:outline-none rounded-lg shadow-sm border focus:border-blue-400 focus:ring-2 transition-all ${
                isCodeFile ? 'font-mono text-sm' : 'text-lg'
              } ${darkMode ? 'bg-gray-800 text-gray-100 border-gray-700 focus:ring-blue-900' : 'bg-white text-gray-800 border-gray-200 focus:ring-blue-100'}`}
              placeholder={isCodeFile ? "// Start coding..." : "Start typing... Changes sync in real-time!"}
              style={{ fontFamily: isCodeFile ? 'monospace' : 'Georgia, serif' }}
              spellCheck={!isCodeFile}
            />
          </div>
        </div>

        {/* Status Bar */}
        <div className={`${darkMode ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-white border-gray-200 text-gray-600'} border-t px-6 py-2 flex items-center justify-between text-sm`}>
          <div className="flex items-center gap-4">
            <span>{content.length} characters</span>
            <span>{content.split(/\s+/).filter(w => w.length > 0).length} words</span>
            <span>{content.split('\n').length} lines</span>
            {isCodeFile && <span className={darkMode ? 'text-blue-400' : 'text-blue-600'}>• {activeDoc?.type.toUpperCase()}</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Connected • Real-time Sync Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;