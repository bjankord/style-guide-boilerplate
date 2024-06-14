const dog = () => {
  return 'dog';
}

// const components = await Astro.glob('../components/**/*.html'); // returns an array of posts that live at ./src/pages/post/*.md
const core = import.meta.glob('../../core/**/*.html'); //relative to this component file
const components = import.meta.glob('../../components/**/*.html'); //relative to this component file
const patterns = import.meta.glob('../../patterns/**/*.html');

const units = {...core, ...components, ...patterns};
const collectionTree = {};

Object.keys(units).forEach((currentValue) => {
	console.log('currentValue', currentValue);
	const pathSplit = currentValue.split('/');
	console.log('pathSplit', pathSplit);

	const unitCategory = pathSplit[2].toLowerCase();
	const unitName = pathSplit[3].toLowerCase();

	console.log('unitCategory', unitCategory);
	console.log('unitName', unitName);

	/**
	 * if collectionTree doesnt contain key named unitCategory, add it to
	 * collectionTree object
	 */
	if (unitCategory in collectionTree === false) {
		collectionTree[unitCategory] = {};
	}


  if (unitName in collectionTree[unitCategory] === false) {
		collectionTree[unitCategory][unitName] = {
			componentPath: currentValue,
		}
	}
});

console.log('collectionTree', collectionTree);

/* input
{
  '../../components/core/Address/address.html': [Function: ../../components/core/Address/address.html],
  '../../components/core/blockquote.html': [Function: ../../components/core/blockquote.html]
}
*/

/* output
{
	core: {
		address: {
			'../../components/core/Address/address.html'
		}
		blockquote: {
			'../../components/core/Blockquote/blockquote.html'
		}
	}
}
*/

export { dog, collectionTree };