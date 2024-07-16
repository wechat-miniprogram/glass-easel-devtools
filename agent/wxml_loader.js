// eslint-disable-next-line import/no-extraneous-dependencies
const { TmplGroup } = require('glass-easel-template-compiler')

module.exports = (src) => {
  const group = new TmplGroup()
  group.addTmpl('', src)
  const genObjectSrc = group.getTmplGenObjectGroups()
  group.free()
  // console.info(genObjectSrc)
  return `
    var groupList = ${genObjectSrc};
    module.exports = { groupList: groupList, content: groupList[''] };
  `
}
