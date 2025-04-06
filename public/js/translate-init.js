// public/js/translate-init.js
document.addEventListener('DOMContentLoaded', function() {
  // 检查translate对象是否存在
  if (typeof translate !== 'undefined') {
    // 初始化翻译组件
    translate.setUseVersion2();
    
    // 获取翻译按钮
    const translateBtn = document.getElementById('translateBtn');
    if (translateBtn) {
      translateBtn.addEventListener('click', function() {
        // 显示语言选择器
        if (document.querySelector('.translateSelectLanguage')) {
          // 如果选择器已存在，切换其可见性
          const selector = document.querySelector('.translateSelectLanguage');
          selector.style.display = selector.style.display === 'none' ? '' : 'none';
        } else {
          // 第一次点击，执行翻译初始化
          translate.execute();
        }
      });
    }
  }
});
