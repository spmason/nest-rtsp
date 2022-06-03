const sleep = async ms => {
	if ( 0 == ms ) {
		return
	}
	return new Promise( resolve=>{
		setTimeout( resolve,ms )
	} )
}

module.exports = sleep