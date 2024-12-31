import sdk from 'node-appwrite';

// Initialize Appwrite SDK using environment variables
const client = new sdk.Client();
client.setEndpoint(process.env.APPWRITE_ENDPOINT)  // Appwrite endpoint
      .setProject(process.env.APPWRITE_PROJECT_ID)  // Project ID
      .setKey(process.env.APPWRITE_API_KEY);  // API Key

const database = new sdk.Databases(client);
const messagesCollectionId = process.env.CHAT_MESSAGES_COLLECTION_ID; // Chat messages collection ID from env
const groupsCollectionId = process.env.GROUPS_COLLECTION_ID; // Groups collection ID from env
const ticketsForInstantSaleCollectionId = process.env.TICKETS_FOR_INSTANT_SALE_COLLECTION_ID
const ticketsCollectionId = process.env.TICKETS_COLLECTION_ID
const expiredTicketsCollectionId = process.env.EXPIRED_TICKETS_COLLECTION_ID;

async function deleteChatMessages() {
  try {
    // Fetch all messages from the chat messages collection
    const messages = await database.listDocuments(messagesCollectionId);

    for (let message of messages.documents) {
      // Get the group ID from the message
      const groupId = message.groupsId;

      // Check if the group exists in the groups collection by querying with groupId
      const groupExists = await database.listDocuments(groupsCollectionId, [
        sdk.Query.equal('$id', groupId) // Check if the document ID (groupId) matches
      ]);

      // If the group does not exist, delete the message
      if (groupExists.documents.length === 0) {
        await database.deleteDocument(messagesCollectionId, message.$id);
        console.log(`Deleted message with ID: ${message.$id}`);
      }
    }
  } catch (error) {
    console.error('Error deleting chat messages:', error);
  }
}

async function deleteExpiredInstantSaleTickets() {
  try {
    // Fetch all instant sale tickets from the tickets collection
    const tickets = await database.listDocuments(ticketsForInstantSaleCollectionId);

    for (let ticket of tickets.documents) {
      const expiryDateStr = ticket.expiry; // Assuming expiryDate is in 'DD/MM/YYYY' format
      const expiryDateParts = expiryDateStr.split('/');
      const expiryDate = new Date(`${expiryDateParts[1]}/${expiryDateParts[0]}/${expiryDateParts[2]}`);
      const currentDate = new Date();

      // Check if the ticket has expired
      if (expiryDate < currentDate) {
        // Update the original ticket's quantity and mark it as not listed
        const originalTicketId = ticket.ticketId; // Assuming you have an 'originalTicketId' field to link the original ticket
        const listingQuantity = ticket.quantity;

        // Fetch the original ticket
        const originalTicket = await database.getDocument(ticketsCollectionId, originalTicketId);

        // Update the quantity of the original ticket and mark as not listed
        const updatedQuantity = originalTicket.quantity + listingQuantity;
        await database.updateDocument(ticketsCollectionId, originalTicketId, {
          quantity: updatedQuantity,
          isListedForSale: false
        });

        console.log(`Updated original ticket with ID: ${originalTicketId}, new quantity: ${updatedQuantity}`);

        // Delete the expired instant sale ticket from the tickets collection
        await database.deleteDocument(ticketsForInstantSaleCollectionId, ticket.$id);
        console.log(`Deleted expired instant sale ticket with ID: ${ticket.$id}`);
      }
    }
  } catch (error) {
    console.error('Error deleting expired instant sale tickets:', error);
  }
}

async function moveExpiredTickets() {
  try {
    // Fetch all tickets from the tickets collection
    const tickets = await database.listDocuments(ticketsCollectionId);

    for (let ticket of tickets.documents) {
      const eventDateStr = ticket.eventDate; // Assuming eventDate is a string in the format "Month Day, Year" (e.g., "June 5, 2024")
      const eventDate = new Date(eventDateStr); // Parse the date string into a Date object
      const currentDate = new Date();

      // Check if the event date has passed
      if (eventDate < currentDate) {
        // Move the expired ticket to the expired tickets collection
        await database.createDocument(expiredTicketsCollectionId, ticket);

        // Delete the expired ticket from the tickets collection
        await database.deleteDocument(ticketsCollectionId, ticket.$id);
        console.log(`Moved ticket with ID: ${ticket.$id} to expired tickets.`);
      }
    }
  } catch (error) {
    console.error('Error moving expired tickets:', error);
  }
}

// Call all the functions
async function performScheduledTasks() {
  await deleteChatMessages();
  await moveExpiredTickets();
  await deleteExpiredInstantSaleTickets();
}

// Run the tasks
performScheduledTasks();
