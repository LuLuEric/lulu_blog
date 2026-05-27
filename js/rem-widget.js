(function () {
    var assetRoot = "/lulu_blog/Live2dRem/live2d/";

    window.message_Path = assetRoot;
    window.talkAPI = "";

    document.write('<link rel="stylesheet" href="' + assetRoot + 'css/live2d.css">');
    document.write(
        '<style>' +
            '#landlord{user-select:none;position:fixed;left:5px;bottom:0;width:250px;height:280px;z-index:10000;font-size:0;display:none;}' +
            '#live2d{width:250px;height:280px;position:relative;z-index:3;}' +
            '#open_live2d{position:fixed;left:5px;bottom:5px;z-index:10000;display:none;}' +
            '@media (max-width:860px){#landlord,#open_live2d{display:none!important;}}' +
        '</style>'
    );
    document.write(
        '<div id="landlord" style="left:5px;bottom:0px;">' +
            '<div class="message" style="opacity:0"></div>' +
            '<canvas id="live2d" width="500" height="560" class="live2d"></canvas>' +
            '<input name="live_talk" id="live_talk" value="1" type="hidden">' +
            '<div class="live_ico_box">' +
                '<div class="live_ico_item type_youdu" id="youduButton" title="变换效果"></div>' +
                '<div class="live_ico_item type_quit" id="hideButton" title="隐藏蕾姆"></div>' +
                '<input name="live_statu_val" id="live_statu_val" value="0" type="hidden">' +
                '<input id="duType" value="douqilai,l2d_caihong" type="hidden">' +
            '</div>' +
        '</div>' +
        '<div id="open_live2d">召唤蕾姆</div>'
    );
    document.write('<script src="/lulu_blog/js/jquery.min.js"><\/script>');
    document.write('<script src="' + assetRoot + 'js/live2d.js"><\/script>');
    document.write('<script src="' + assetRoot + 'js/message.js"><\/script>');
})();
