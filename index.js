const contractSource = `
contract Books =

  record book =
    { creatorAddress : address,
      url            : string,
      name           : string,
      catalogue      : string,
      author         : string,
      description    : string,
      voteCount      : int }

  record catalogue =
    { creatorAddress : address,
      url            : string,
      name           : string,
      voteCount      : int,
      description    : string }

  record state =
    { books      : map(int, book),
      catalogues : map(int, catalogue),
      booksLength : int,
      catalogueLength : int }

  entrypoint init() =
    { books           = {},
      catalogues      = {},
      catalogueLength = 0,
      booksLength     = 0 }

  entrypoint getBook(index : int) : book =
    switch(Map.lookup(index, state.books))
      None    => abort("There was no book with this index registered.")
      Some(x) => x

  entrypoint getCatalogue(index : int) : catalogue =
    switch(Map.lookup(index, state.catalogues))
      None    => abort("There was no catalogue with this index registered.")
      Some(x) => x

  stateful entrypoint registerBook(url' : string, name' : string, catalogue' : string, author' : string, description' : string) =
    let book = { creatorAddress = Call.caller, url = url', name = name', catalogue = catalogue', author = author', description = description', voteCount = 0}
    let index = getBooksLength() + 1
    put(state{ books[index] = book, booksLength = index })

  stateful entrypoint registerCatalogue(url' : string, name' : string, description' : string) =
    let catalogue = { creatorAddress = Call.caller, url = url', name = name', description = description', voteCount = 0}
    let index = getCataloguesLength() + 1
    put(state{ catalogues[index] = catalogue, catalogueLength = index })

  entrypoint getBooksLength() : int =
    state.booksLength

  entrypoint getCataloguesLength() : int =
    state.catalogueLength

  stateful entrypoint voteBook(index : int) =
    let book = getBook(index)
    Chain.spend(book.creatorAddress, Call.value)
    let updatedVoteCount = book.voteCount + Call.value
    let updatedBooks = state.books{ [index].voteCount = updatedVoteCount }
    put(state{ books = updatedBooks })
`;

//Address of the book voting smart contract on the testnet of the aeternity blockchain
const contractAddress = 'ct_FHQHahXTQ9x8MqY1sjXkJC1PbrfWHMPSmTejax1LbwDpqDAj5';
//Create variable for client so it can be used in different functions
var client = null;
//Create a new global array for the books
var bookArray = [];
//Create a new global array for the catalogues
var booksLength = 0;

function renderBooks() {
  //Order the books array so that the book with the most votes is on top
  bookArray = bookArray.sort(function(a,b){return b.votes-a.votes})
  //Get the template we created in a block scoped variable
  let template = $('#template').html();
  //Use mustache parse function to speeds up on future uses
  Mustache.parse(template);
  //Create variable with result of render func form template and data
  let rendered = Mustache.render(template, {bookArray});
  //Use jquery to add the result of the rendering to our html
  $('#bookBody').html(rendered);
}

//Create a asynchronous read call for our smart contract
async function callStatic(func, args) {
  //Create a new contract instance that we can interact with
  const contract = await client.getContractInstance(contractSource, {contractAddress});
  //Make a call to get data of smart contract func, with specefied arguments
  const calledGet = await contract.call(func, args, {callStatic: true}).catch(e => console.error(e));
  //Make another call to decode the data received in first call
  const decodedGet = await calledGet.decode().catch(e => console.error(e));

  return decodedGet;
}

//Create a asynchronous write call for our smart contract
async function contractCall(func, args, value) {
  const contract = await client.getContractInstance(contractSource, {contractAddress});
  //Make a call to write smart contract func, with aeon value input
  const calledSet = await contract.call(func, args, {amount: value}).catch(e => console.error(e));

  return calledSet;
}

// https://app.dacade.org/assets/img/ITBCover.png

//Execute main function
window.addEventListener('load', async () => {
  //Display the loader animation so the user knows that something is happening
  $("#loader").show();

  //Initialize the Aepp object through aepp-sdk.browser.js, the base app needs to be running.
  client = await Ae.Aepp();

  //First make a call to get to know how may books have been created and need to be displayed
  //Assign the value of book length to the global variable
  booksLength = await callStatic('getBooksLength', []);

  //Loop over every book to get all their relevant information
  for (let i = 1; i <= booksLength; i++) {

    //Make the call to the blockchain to get all relevant information on the book
    const book = await callStatic('getBook', [i]);

    //Create book object with  info from the call and push into the array with all books
    bookArray.push({
      creatorName: book.name,
      bookUrl: book.url,
      bookAuthor: book.author,
      catalogue: book.catalogue,
      bookDesc: book.description,
      index: i,
      votes: book.voteCount,
    })
  }

  //Display updated books
  renderBooks();

  //Hide loader animation
  $("#loader").hide();
});

//If someone clicks to vote on a book, get the input and execute the voteCall
jQuery("#bookBody").on("click", ".voteBtn", async function(event){
  $("#loader").show();
  //Create two new let block scoped variables, value for the vote input and
  //index to get the index of the book on which the user wants to vote
  let value = $(this).siblings('input').val(),
      index = event.target.id;

  //Promise to execute execute call for the vote book function with let values
  await contractCall('voteBook', [index], value);

  //Hide the loading animation after async calls return a value
  const foundIndex = bookArray.findIndex(book => book.index == event.target.id);
  //console.log(foundIndex);
  bookArray[foundIndex].votes += parseInt(value, 10);

  renderBooks();
  $("#loader").hide();
});

//If someone clicks to register a book, get the input and execute the registerCall
$('#registerBtn').click(async function(){
  $("#loader").show();
  //Create two new let variables which get the values from the input fields
  const name = ($('#regName').val()),
        description = ($('#regDesc').val()),
        catalogue = ($('#regCatalogue').val()),
        author = ($('#regAuthor').val()),
        url = ($('#regUrl').val());

  //Make the contract call to register the book with the newly passed values
  await contractCall('registerBook', [url, name, catalogue, author, description], 0);

  //Add the new created bookobject to our bookarray
  bookArray.push({
    creatorName: name,
    bookUrl: url,
    bookDesc: description,
    catalogue: catalogue,
    bookAuthor: author,
    index: bookArray.length+1,
    votes: 0,
  })

  renderBooks();
  $('#regForm').each(function(){
      this.reset();
  });
  $("#loader").hide();
});
